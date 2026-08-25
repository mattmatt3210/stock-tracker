import { generateText, NoObjectGeneratedError, Output } from "ai"
import { z } from "zod"
import { parseReport, toYahooSymbol } from "./report-parser"
import type { ParsedReport, PivotDirection, ScanRow } from "./report-types"

/**
 * Hermes 每日報告的格式每天都在變（廣東話散文、bullet 前綴、全角／半角混用、
 * 欄位順序不固定），regex 解析器只能吃中一種寫法。這裡改用 LLM 抽取，
 * 但刻意「只讓 LLM 做它擅長的事」：
 *
 *   - LLM 負責：從自由文字辨識語意（哪個是持倉、哪個是 setup、方向是回測還是突破）
 *   - 程式負責：Yahoo 代碼對應、數值正規化、方向推導的保底邏輯
 *
 * Yahoo 代碼一律由 toYahooSymbol() 決定，不讓模型自己編，
 * 否則會出現 1888.HK / 01888.HK / HK1888 之類的幻覺造成報價抓不到。
 */

const MODEL = "openai/gpt-5-mini"

/** LLM 回傳的中間結構：只要 rawTicker，不要 yahooSymbol */
const numeric = z.number().nullable().describe("數值，取不到寫 null，不要猜")

const scanRowSchema = z.object({
  rawTicker: z.string().describe("原始代碼，如 US.NVDA、HK.01888、01888、NVDA，保留原文"),
  close: numeric.describe("收盤價"),
  changePct: numeric.describe("當日漲跌百分比，跌用負數"),
  stage2: z.string().describe("Stage 2 狀態原文，如「Stage 2 完整」「未確認」，沒寫則空字串"),
  stage2Ok: z.boolean().describe("是否明確通過/符合 Stage 2"),
  note: z.string().describe("其他備註，沒有則空字串"),
  unavailable: z.boolean().describe("代碼查不到、無資料、已除牌時為 true"),
})

const extractionSchema = z.object({
  title: z.string().nullable().describe("報告標題，沒有則 null"),
  reportDate: z
    .string()
    .nullable()
    .describe("報告日期 YYYY-MM-DD。標題若同時有 HKT 日期與美股收市日期，取標題主日期"),
  dateLabel: z.string().nullable().describe("完整日期說明行原文，去掉開頭 emoji"),
  alerts: z.array(z.string()).describe("⚠️ 系統警示／資料落差提示，逐條列出"),

  market: z.object({
    verdict: z.string().nullable().describe("大市判斷結論，如 risk-on、觀望、偏空"),
    verdictTone: z.enum(["on", "off", "neutral"]).describe("risk-on=on，risk-off/偏空=off，其餘 neutral"),
    indices: z.array(
      z.object({
        symbol: z.string().describe("指數代碼，如 SPY、QQQ、恒指"),
        close: numeric,
        changePct: numeric,
        ma50: numeric.describe("50 日均線"),
        ma200: numeric.describe("200 日均線"),
        stage2: z.boolean().describe("是否在 Stage 2 / 均線之上"),
        note: z.string().describe("備註原文，沒有則空字串"),
      }),
    ),
  }),

  positions: z.array(
    z.object({
      rawTicker: z.string().describe("原始代碼，保留原文"),
      name: z.string().describe("股票名稱，沒寫則空字串"),
      shares: numeric.describe("持股數量"),
      cost: numeric.describe("成本價／平均買入價"),
      reportPrice: numeric.describe("報告當時的現價／收盤價"),
      pnlPct: numeric.describe("浮動盈虧百分比，蝕錢用負數"),
      marketValue: numeric.describe("市值，沒寫則 null"),
      currency: z.string().nullable().describe("USD 或 HKD，依代碼判斷"),
      note: z.string().describe("備註，如止蝕位、建議動作"),
    }),
  ),

  totals: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("總資產／總持倉／現金等匯總數字"),

  corePool: z.array(scanRowSchema).describe("核心池／核心觀察名單的覆核結果"),
  extendedPool: z.array(scanRowSchema).describe("擴展池／次級名單的覆核結果"),

  setups: z
    .array(
      z.object({
        rank: z.number().describe("排序，從 1 開始"),
        rawTicker: z.string(),
        name: z.string().describe("股票名稱，沒寫則空字串"),
        condition: z.string().describe("進場條件原文，如「等回測 50MA」「突破 20 日高」"),
        direction: z
          .enum(["breakout", "pullback"])
          .describe(
            "極重要：等突破/升穿/突破即落 = breakout；等回測/回調/跌到/回落至 = pullback。看不出來時，若條件含「突破」用 breakout，含「回測」「回調」用 pullback",
          ),
        pivot: numeric.describe("進場觸發價（樞紐價）"),
        stopLoss: numeric.describe("止蝕價"),
        shares: numeric.describe("建議股數"),
        notional: numeric.describe("建議金額"),
        weightPct: numeric.describe("建議倉位百分比"),
        rationale: z.string().describe("理由／邏輯說明"),
        orderCommand: z
          .string()
          .nullable()
          .describe("報告要求回覆的落單指令原文，如「落 LITE」「落 TSM」，沒有則 null"),
      }),
    )
    .describe("A 級 setup／建議觀望名單。報告明說今日無 setup 時回空陣列"),

  setupNotice: z.string().nullable().describe("關於 setup 的整體說明，如「今日無 A 級 setup」"),
  requests: z.array(z.string()).describe("請示事項／需要用戶決定的問題"),
  orderCommands: z
    .array(z.object({ command: z.string(), description: z.string() }))
    .describe("報告列出的可回覆指令對照表"),
  footnotes: z.array(z.string()).describe("註腳、免責聲明"),
})

type Extraction = z.infer<typeof extractionSchema>

const SYSTEM_PROMPT = `你是一個金融報告結構化抽取器。輸入是 Hermes Agent 產生的每日股票動能掃描報告，
內容混合繁體中文、廣東話口語與英文，格式每天不同（有時用表格、有時用 bullet、有時純散文）。

規則：
1. 只抽取報告真實存在的內容。報告沒寫的數值一律填 null，絕對不要推算或編造。
2. 代碼保留報告原文（US.NVDA、HK.01888、01888、NVDA 都照原樣填入 rawTicker）。不要自行轉換格式。
3. direction 欄位最關鍵：分清楚「等回測／回調／跌到某價才買」是 pullback，
   「等突破／升穿／突破即落」是 breakout。這決定系統如何計算距進場價的距離，錯了會誤導交易判斷。
4. 報告明確說「今日無 A 級 setup」「繼續觀望」時，setups 回空陣列，並把該句放進 setupNotice。
5. 持倉、核心池、擴展池要分清楚。核心池／擴展池是「觀察名單覆核」，不是持倉。
6. 百分比一律用數字（-6.3 而非 "-6.3%"）。跌／蝕用負數。
7. 數字要去掉千分位逗號與貨幣符號（$1,035,264 -> 1035264）。`

/** 把 LLM 的 rawTicker 對應成 Yahoo 代碼（程式決定，不信模型） */
function withSymbol<T extends { rawTicker: string }>(row: T) {
  return { ...row, yahooSymbol: toYahooSymbol(row.rawTicker) }
}

/**
 * 方向的保底推導：模型偶爾會把方向填反，
 * 條件文字裡的關鍵詞比模型判斷更可靠，故以文字為準覆寫。
 */
function resolveDirection(condition: string, modelGuess: PivotDirection): PivotDirection {
  const c = condition ?? ""
  if (/突破|升穿|上穿|破頂|新高/.test(c)) return "breakout"
  if (/回測|回調|回落|跌至|跌到|吸納|支撐/.test(c)) return "pullback"
  return modelGuess
}

function normalizeScanRow(row: Extraction["corePool"][number]): ScanRow {
  return {
    ...withSymbol(row),
    close: row.close,
    changePct: row.changePct,
    stage2: row.stage2 ?? "",
    stage2Ok: row.stage2Ok,
    note: row.note ?? "",
    unavailable: row.unavailable,
  }
}

/** 將 LLM 抽取結果轉成 app 使用的 ParsedReport */
function toParsedReport(x: Extraction, rawText: string): ParsedReport {
  // jobId 用 regex 抓比較可靠（是機械格式，不需要 LLM）
  const jobId = rawText.match(/Job\s*ID\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] ?? null

  return {
    jobId,
    title: x.title,
    reportDate: x.reportDate,
    dateLabel: x.dateLabel,
    alerts: x.alerts,
    market: {
      verdict: x.market.verdict,
      verdictTone: x.market.verdictTone,
      indices: x.market.indices.map((i) => ({ ...i, note: i.note ?? "" })),
    },
    positions: x.positions.map((p) => ({ ...withSymbol(p), note: p.note ?? "", name: p.name ?? "" })),
    totals: x.totals,
    corePool: x.corePool.map(normalizeScanRow),
    extendedPool: x.extendedPool.map(normalizeScanRow),
    setups: x.setups.map((s) => ({
      ...withSymbol(s),
      name: s.name ?? "",
      condition: s.condition ?? "",
      direction: resolveDirection(s.condition, s.direction),
      rationale: s.rationale ?? "",
    })),
    setupNotice: x.setupNotice,
    requests: x.requests,
    orderCommands: x.orderCommands,
    footnotes: x.footnotes,
    // LLM 已涵蓋所有已知區塊，不需要 regex 的「未歸類段落」保底
    extraSections: [],
  }
}

export type ExtractResult = {
  parsed: ParsedReport
  /** llm = LLM 抽取成功；regex = LLM 失敗已退回 regex 解析器 */
  method: "llm" | "regex"
  error?: string
}

/**
 * 用 LLM 抽取報告結構；失敗時退回 regex 解析器，
 * 確保 webhook 不會因為 AI Gateway 出問題就整份收不到。
 */
export async function extractReport(
  text: string,
  opts: { model?: string; timeoutMs?: number } = {},
): Promise<ExtractResult> {
  try {
    const { output } = await generateText({
      model: opts.model ?? MODEL,
      system: SYSTEM_PROMPT,
      prompt: `以下是今日的 Hermes 掃描報告原文，請抽取成結構化資料：\n\n${text}`,
      // 抽取是機械性工作，不需要深度推理；低推理可省下大量延遲
      reasoning: "low",
      // 沒有超時的話，gateway 卡住會讓 webhook 無限期掛住
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      output: Output.object({
        name: "HermesReport",
        description: "Hermes Agent 每日股票動能掃描報告的結構化內容",
        schema: extractionSchema,
      }),
    })

    return { parsed: toParsedReport(output, text), method: "llm" }
  } catch (error) {
    const reason = NoObjectGeneratedError.isInstance(error)
      ? `模型輸出不符 schema: ${error.cause}`
      : error instanceof Error
        ? error.message
        : "未知錯誤"

    console.log("[v0] LLM 抽取失敗，退回 regex 解析:", reason)
    return { parsed: parseReport(text), method: "regex", error: reason }
  }
}
