import type {
  ParsedReport,
  Position,
  ScanRow,
  Setup,
  MarketIndex,
  PivotDirection,
  ReportSection,
  PortfolioTotals,
} from "./report-types"

/* ------------------------------------------------------------------ */
/* 基礎工具                                                            */
/* ------------------------------------------------------------------ */

/** 移除 Slack 風格粗體與反引號，並正規化全角空白 */
function clean(s: string): string {
  return s
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\u3000/g, " ")
    .trim()
}

/**
 * 去掉開頭的 emoji / 符號裝飾。
 * 用 Unicode property escape 一次處理完整 code point，避免切斷 surrogate pair
 * 造成亂碼（例如 📊 被截成半個字元）。
 */
function stripLeadingSymbols(s: string): string {
  return s.replace(/^(?:[\p{Extended_Pictographic}\p{So}\uFE0F\u200D\s])+/u, "").trim()
}

/** 抽出數字，支援千分位逗號、$ 前綴、+/- 號 */
function num(s: string | undefined | null): number | null {
  if (!s) return null
  const m = s.replace(/,/g, "").match(/-?\+?\d+(?:\.\d+)?/)
  if (!m) return null
  const v = Number.parseFloat(m[0].replace("+", ""))
  return Number.isFinite(v) ? v : null
}

/** 帶正負號的百分比 */
function pct(s: string | undefined | null): number | null {
  if (!s) return null
  const m = s.replace(/,/g, "").match(/([+-]?\d+(?:\.\d+)?)\s*%/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) ? v : null
}

/**
 * 報告代碼轉 Yahoo Finance 代碼。
 * US.NVDA  -> NVDA
 * HK.01888 -> 1888.HK   （Yahoo 港股用 4 位補零）
 */
export function toYahooSymbol(rawTicker: string): string | null {
  const t = clean(rawTicker).toUpperCase()
  const us = t.match(/^US\.([A-Z0-9.\-]+)$/)
  if (us) return us[1]
  const hk = t.match(/^HK\.(\d+)$/)
  if (hk) {
    const digits = hk[1].replace(/^0+/, "") || "0"
    return `${digits.padStart(4, "0")}.HK`
  }
  // 已經是純美股代碼
  if (/^[A-Z]{1,6}$/.test(t)) return t
  return null
}

/** 以 | 或全角 ｜ 切欄位 */
function splitCells(line: string): string[] {
  return line
    .split(/[|｜]/)
    .map((c) => clean(c))
    .filter((c, i, arr) => !(c === "" && (i === 0 || i === arr.length - 1)))
}

/* ------------------------------------------------------------------ */
/* 分段：把報告切成「一、二、三…」等區塊                                 */
/* ------------------------------------------------------------------ */

const SECTION_RE = /^\s*([一二三四五六七八九十]+)\s*、\s*(.*)$/

interface RawSection {
  index: string
  heading: string
  lines: string[]
}

function splitSections(lines: string[]): { preamble: string[]; sections: RawSection[] } {
  const preamble: string[] = []
  const sections: RawSection[] = []
  let current: RawSection | null = null

  for (const line of lines) {
    const m = line.match(SECTION_RE)
    if (m) {
      current = { index: m[1], heading: clean(m[2]), lines: [] }
      sections.push(current)
      continue
    }
    if (current) current.lines.push(line)
    else preamble.push(line)
  }
  return { preamble, sections }
}

/** 依標題關鍵字找區塊，找不到回 null（報告格式微調時不會整份解析失敗） */
function findSection(sections: RawSection[], ...keywords: string[]): RawSection | null {
  for (const s of sections) {
    if (keywords.some((k) => s.heading.includes(k))) return s
  }
  return null
}

/* ------------------------------------------------------------------ */
/* 一、大市狀態                                                        */
/* ------------------------------------------------------------------ */

function parseMarket(section: RawSection | null): ParsedReport["market"] {
  const indices: MarketIndex[] = []
  let verdict: string | null = null

  if (section) {
    for (const raw of section.lines) {
      const line = clean(raw).replace(/^[-•]\s*/, "")
      if (!line) continue

      const v = line.match(/^判定\s*[:：]\s*(.+)$/)
      if (v) {
        verdict = v[1].trim()
        continue
      }

      // 例：SPY 收777.88（+0.70%），>MA50 748、>MA200 702 ✅ Stage 2
      const m = line.match(/^([A-Z][A-Z0-9.]*)\s*收\s*([\d,.]+)/)
      if (!m) continue

      indices.push({
        symbol: m[1],
        close: num(m[2]),
        changePct: pct(line),
        ma50: num(line.match(/MA50\s*([\d,.]+)/)?.[1]),
        ma200: num(line.match(/MA200\s*([\d,.]+)/)?.[1]),
        stage2: line.includes("Stage 2") && line.includes("✅"),
        note: line,
      })
    }
  }

  const tone: "on" | "off" | "neutral" = !verdict
    ? "neutral"
    : /risk-on/i.test(verdict)
      ? "on"
      : /risk-off/i.test(verdict)
        ? "off"
        : "neutral"

  return { indices, verdict, verdictTone: tone }
}

/* ------------------------------------------------------------------ */
/* 二、現倉檢討                                                        */
/* ------------------------------------------------------------------ */

const TICKER_RE = /((?:US|HK)\.[A-Z0-9.]+)/

function parsePositions(section: RawSection | null): {
  positions: Position[]
  totals: PortfolioTotals[]
} {
  const positions: Position[] = []
  const totals: PortfolioTotals[] = []
  if (!section) return { positions, totals }

  for (const raw of section.lines) {
    const line = raw.replace(/^\s*[-•]\s*/, "").trimEnd()
    if (!clean(line)) continue

    const hasTicker = TICKER_RE.test(line)
    const looksLikePosition = hasTicker && /股/.test(line) && /成本/.test(line)

    if (!looksLikePosition) {
      // 合計 / 現金列，例：HK總持倉 ≈ *400,430 HKD* + 現金 *634,834 HKD* = *$1,035,264 HKD*
      const c = clean(line)
      if (/總持倉|現金|總資產/.test(c)) {
        const [label, ...rest] = c.split(/[:：]/)
        if (rest.length > 0) {
          totals.push({ label: label.trim(), value: rest.join(":").trim() })
        } else {
          // 「HK總持倉 ≈ 400,430 HKD + 現金 ... = $1,035,264 HKD」
          // 標籤取 ≈ 之前，數值取最後一個 = 之後，避免 value 重複整行
          const parts = c.split(/\s*[≈=]\s*/)
          totals.push({
            label: parts[0].trim(),
            value: parts.length > 1 ? parts[parts.length - 1].trim() : c,
          })
        }
      }
      continue
    }

    const cells = splitCells(line)
    // cells[0] = "HK.01888 建滔積層板"
    const head = cells[0] ?? ""
    const tickerMatch = head.match(TICKER_RE)
    const rawTicker = tickerMatch ? tickerMatch[1] : ""
    const name = head.replace(rawTicker, "").trim()

    let shares: number | null = null
    let cost: number | null = null
    let reportPrice: number | null = null
    let pnlPct: number | null = null
    let marketValue: number | null = null
    let currency: string | null = null
    const noteParts: string[] = []

    for (const cell of cells.slice(1)) {
      if (/^\d[\d,]*\s*股$/.test(cell)) {
        shares = num(cell)
      } else if (/成本/.test(cell)) {
        cost = num(cell)
      } else if (/現價/.test(cell)) {
        reportPrice = num(cell)
      } else if (/^[+-][\d.]+%$/.test(cell)) {
        pnlPct = pct(cell)
      } else if (/\bMV\b/.test(cell)) {
        // "MV 135,030 HKD Stage 2 ✅（...）" —— 市值後面還黏著備註
        const mv = cell.match(/MV\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{3})?/)
        if (mv) {
          marketValue = num(mv[1])
          currency = mv[2] ?? null
          const rest = cell.slice((mv.index ?? 0) + mv[0].length).trim()
          if (rest) noteParts.push(rest)
        } else {
          noteParts.push(cell)
        }
      } else if (cell) {
        if (pnlPct === null && /%/.test(cell)) pnlPct = pct(cell)
        else noteParts.push(cell)
      }
    }

    positions.push({
      rawTicker,
      yahooSymbol: toYahooSymbol(rawTicker),
      name,
      shares,
      cost,
      reportPrice,
      pnlPct,
      marketValue,
      currency,
      note: noteParts.join(" ").trim(),
    })
  }

  return { positions, totals }
}

/* ------------------------------------------------------------------ */
/* 三 / 四、核心池與擴展池（markdown 表格）                              */
/* ------------------------------------------------------------------ */

function parseScanTable(section: RawSection | null): ScanRow[] {
  const rows: ScanRow[] = []
  if (!section) return rows

  for (const raw of section.lines) {
    const line = raw.trim()
    if (!line.startsWith("|") && !line.startsWith("｜")) continue
    // 跳過分隔列 |---|---|
    if (/^[|｜\s\-:]+$/.test(line)) continue

    const cells = splitCells(line)
    if (cells.length < 2) continue
    // 跳過表頭
    if (/^股$/.test(cells[0]) || cells[0] === "") continue

    const tickerMatch = cells[0].match(TICKER_RE)
    const rawTicker = tickerMatch ? tickerMatch[1] : cells[0]
    const closeCell = cells[1] ?? ""
    const stage2Cell = cells[3] ?? ""
    const note = cells[4] ?? ""

    // 「—」代表查不到資料（例如已除牌）
    const unavailable = /^[—–-]$/.test(closeCell.trim())

    rows.push({
      rawTicker,
      yahooSymbol: toYahooSymbol(rawTicker),
      close: unavailable ? null : num(closeCell),
      changePct: unavailable ? null : pct(cells[2] ?? ""),
      stage2: stage2Cell,
      stage2Ok: stage2Cell.includes("✅"),
      note,
      unavailable,
    })
  }

  return rows
}

/* ------------------------------------------------------------------ */
/* 五、A級 Setup                                                       */
/* ------------------------------------------------------------------ */

// 例： *1) US.LITE（光通訊 AI龍頭）* — 等回測 50MA
const SETUP_HEAD_RE = /^\s*\*?\s*(\d+)\)\s*([A-Z]{2}\.[A-Z0-9.]+)\s*(?:[（(]([^）)]*)[）)])?\s*\*?\s*(?:[—–-]+\s*(.*))?$/

function directionOf(text: string): PivotDirection {
  // 「等突破」「升破」「≥」= 突破買入；「回測」「跌到」「≤」= 回調買入
  if (/突破|升破|新高|站上|≥|>=/.test(text)) return "breakout"
  if (/回測|回落|跌到|跌至|≤|<=/.test(text)) return "pullback"
  return "breakout"
}

function parseSetups(section: RawSection | null): { setups: Setup[]; notice: string | null } {
  const setups: Setup[] = []
  let notice: string | null = null
  if (!section) return { setups, notice }

  let current: Setup | null = null

  for (const raw of section.lines) {
    const line = raw.trimEnd()
    const c = clean(line).replace(/^[-•]\s*/, "")
    if (!c) continue

    const head = line.match(SETUP_HEAD_RE)
    if (head) {
      const rawTicker = head[2]
      const condition = clean(head[4] ?? "")
      current = {
        rank: Number.parseInt(head[1], 10),
        rawTicker,
        yahooSymbol: toYahooSymbol(rawTicker),
        name: clean(head[3] ?? ""),
        condition,
        direction: directionOf(condition),
        pivot: null,
        stopLoss: null,
        shares: null,
        notional: null,
        weightPct: null,
        rationale: "",
        orderCommand: null,
      }
      setups.push(current)
      continue
    }

    if (!current) {
      // setup 前的提示，例如「今日暫無完整 VCP 多重確認 setup」
      if (/暫無|無完整|watch list|watchlist/i.test(c)) {
        const t = stripLeadingSymbols(c)
        notice = notice ? `${notice}\n${t}` : t
      }
      continue
    }

    if (/Pivot|樞紐/i.test(c) && /買入|入場/.test(c)) {
      current.pivot = num(c.split(/[:：]/).slice(1).join(":"))
      if (/突破|升破|≥/.test(c)) current.direction = "breakout"
      if (/回測|跌到|≤/.test(c)) current.direction = "pullback"
    } else if (/止蝕|止損/.test(c)) {
      current.stopLoss = num(c.split(/[:：]/).slice(1).join(":"))
    } else if (/股數/.test(c)) {
      const body = c.split(/[:：]/).slice(1).join(":")
      current.shares = num(body.match(/~?\s*([\d,]+)\s*股/)?.[1])
      current.notional = num(body.match(/\$\s*([\d,]+(?:\.\d+)?)/)?.[1])
      current.weightPct = pct(body)
    } else if (/邏輯|理由/.test(c)) {
      const body = c.split(/[:：]/).slice(1).join(":").trim()
      current.rationale = body || c
    } else if (current.rationale) {
      current.rationale += ` ${c}`
    }
  }

  return { setups, notice }
}

/* ------------------------------------------------------------------ */
/* 六、請示 / 落單指令                                                  */
/* ------------------------------------------------------------------ */

function parseRequests(section: RawSection | null): {
  requests: string[]
  orderCommands: { command: string; description: string }[]
} {
  const requests: string[] = []
  const orderCommands: { command: string; description: string }[] = []
  if (!section) return { requests, orderCommands }

  for (const raw of section.lines) {
    const c = clean(raw).replace(/^[-•]\s*/, "")
    if (!c) continue

    // 例：回 「落 LITE」 → 等 US.LITE 跌到 ≤$815 買入 180股
    const cmd = c.match(/^回\s*[「『"]([^」』"]+)[」』"]\s*(?:→|->|=>)?\s*(.*)$/)
    if (cmd) {
      orderCommands.push({ command: cmd[1].trim(), description: cmd[2].trim() })
      continue
    }
    if (/^冇回覆|^沒回覆|^無回覆/.test(c)) {
      orderCommands.push({ command: "（不回覆）", description: c })
      continue
    }
    if (/^落單指令/.test(c)) continue
    // 註腳與 cron 系統尾註另外處理，不算請示事項
    if (/^(📌|⚠️|⚠)/.test(c)) continue
    if (/^To stop or manage this job/i.test(c)) continue
    requests.push(c)
  }

  return { requests, orderCommands }
}

/* ------------------------------------------------------------------ */
/* 主解析函式                                                          */
/* ------------------------------------------------------------------ */

export function parseReport(text: string): ParsedReport {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const { preamble, sections } = splitSections(lines)
  const flat = clean(text)

  /* --- 標頭資訊 --- */
  const jobId = text.match(/job_id\s*[:：]\s*([A-Za-z0-9_-]+)/)?.[1] ?? null
  const title =
    text.match(/Cronjob Response\s*[:：]\s*(.+)/)?.[1]?.trim().replace(/\*/g, "") ?? null

  // 📊 *美股收市掃描（2026-08-14，週四，HKT 05:30 收市後出）*
  const dateMatch = flat.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/)
  const reportDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
    : null
  const dateLabelRaw = preamble.map((l) => clean(l)).find((l) => /掃描/.test(l) && /[（(]/.test(l))
  const dateLabel = dateLabelRaw ? stripLeadingSymbols(dateLabelRaw) : null

  /* --- 警示（⚠️ 開頭的段落，含其下的細項） --- */
  const alerts: string[] = []
  let inAlert = false
  for (const raw of preamble) {
    const c = clean(raw)
    if (!c) {
      inAlert = false
      continue
    }
    if (c.startsWith("⚠️") || c.startsWith("⚠")) {
      alerts.push(c.replace(/^⚠️?\s*/, ""))
      inAlert = true
      continue
    }
    if (inAlert && /^[-•]/.test(c)) {
      alerts.push(c.replace(/^[-•]\s*/, ""))
    } else if (inAlert) {
      inAlert = false
    }
  }

  /* --- 各區塊 --- */
  const market = parseMarket(findSection(sections, "大市"))
  const { positions, totals } = parsePositions(findSection(sections, "現倉", "持倉"))
  const corePool = parseScanTable(findSection(sections, "核心池"))
  const extendedPool = parseScanTable(findSection(sections, "擴展池", "延伸池"))
  const { setups, notice } = parseSetups(findSection(sections, "Setup", "setup", "級"))
  const { requests, orderCommands } = parseRequests(findSection(sections, "請示"))

  /* --- 把落單指令回填到對應 setup，並用指令文字校正買入方向 --- */
  for (const oc of orderCommands) {
    const tickerInDesc = oc.description.match(TICKER_RE)?.[1]
    const target = setups.find((s) => {
      if (tickerInDesc && s.rawTicker === tickerInDesc) return true
      const short = s.rawTicker.split(".")[1]
      return short ? oc.command.includes(short) : false
    })
    if (!target) continue
    target.orderCommand = oc.command
    if (/≤|<=|跌到|跌至|回落/.test(oc.description)) target.direction = "pullback"
    else if (/≥|>=|升破|突破/.test(oc.description)) target.direction = "breakout"
  }

  /* --- 註腳（⚠️/📌 結尾說明） --- */
  const footnotes = lines
    .map((l) => clean(l))
    .filter((l) => /^(📌|⚠️|⚠)/.test(l) && /數據來源|核實|價位/.test(l))
    .map((l) => l.replace(/^(📌|⚠️|⚠)\s*/, ""))

  /* --- 未歸類區塊，避免資訊遺失 --- */
  const known = ["大市", "現倉", "持倉", "核心池", "擴展池", "延伸池", "Setup", "setup", "級", "請示"]
  const extraSections: ReportSection[] = sections
    .filter((s) => !known.some((k) => s.heading.includes(k)))
    .map((s) => ({
      heading: s.heading,
      lines: s.lines.map((l) => clean(l)).filter(Boolean),
    }))

  return {
    jobId,
    title,
    reportDate,
    dateLabel,
    alerts,
    market,
    positions,
    totals,
    corePool,
    extendedPool,
    setups,
    setupNotice: notice,
    requests,
    orderCommands,
    footnotes,
    extraSections,
  }
}
