export type HistoryPoint = {
  /** YYYY-MM-DD */
  date: string
  close: number
}

export type StockQuote = {
  /** Yahoo 代碼，例如 NVDA / 1888.HK */
  symbol: string
  name: string
  currency: string
  price: number
  previousClose: number
  change: number
  changePercent: number
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  /** 交易所最後成交時間（unix seconds） */
  marketTime: number | null
  exchange: string
  history: HistoryPoint[]
}

export type QuoteMap = Record<string, StockQuote>

export type QuoteSnapshot = {
  /** 這份即時報價被抓取的時間（ISO） */
  fetchedAt: string
  source: string
  quotes: QuoteMap
  failures: { symbol: string; reason: string }[]
}

/** 走勢圖抓多久的日線 */
const RANGE = "6mo"

function toDateKey(seconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(seconds * 1000))
}

async function fetchOne(symbol: string, revalidate: number | false): Promise<StockQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${RANGE}&interval=1d&includePrePost=false`

  const res = await fetch(url, {
    headers: {
      // Yahoo 對沒有 UA 的請求會擋掉
      "User-Agent": "Mozilla/5.0 (compatible; HermesDashboard/1.0)",
      Accept: "application/json",
    },
    cache: revalidate === false ? "no-store" : undefined,
    next: revalidate === false ? undefined : { revalidate },
  })

  if (!res.ok) throw new Error(`Yahoo 回應 ${res.status}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result?.meta) {
    throw new Error(json?.chart?.error?.description ?? "回應格式不符")
  }

  const meta = result.meta
  const timeZone: string = meta.exchangeTimezoneName ?? "UTC"
  const timestamps: number[] = result.timestamp ?? []
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []

  const history: HistoryPoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (typeof close !== "number" || Number.isNaN(close)) continue
    history.push({ date: toDateKey(timestamps[i], timeZone), close: Number(close.toFixed(4)) })
  }

  const price: number = meta.regularMarketPrice ?? history.at(-1)?.close ?? 0
  const previousClose: number =
    (history.length > 1 && history.at(-2)!.close) || meta.chartPreviousClose || price
  const change = price - previousClose

  return {
    symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    currency: meta.currency ?? (symbol.endsWith(".HK") ? "HKD" : "USD"),
    price,
    previousClose,
    change,
    changePercent: previousClose ? (change / previousClose) * 100 : 0,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    marketTime: meta.regularMarketTime ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? "",
    history,
  }
}

/**
 * 抓取指定代碼的即時報價。
 * 單一代碼失敗不會影響其他代碼（例如報告裡已除牌的 SPCX）。
 * @param revalidate 秒數；傳 false 代表不使用快取。
 */
export async function getQuotes(
  symbols: string[],
  revalidate: number | false = 180,
): Promise<QuoteSnapshot> {
  const unique = [...new Set(symbols.filter(Boolean))]
  const settled = await Promise.allSettled(unique.map((s) => fetchOne(s, revalidate)))

  const quotes: QuoteMap = {}
  const failures: QuoteSnapshot["failures"] = []

  settled.forEach((entry, i) => {
    if (entry.status === "fulfilled") {
      quotes[unique[i]] = entry.value
    } else {
      failures.push({
        symbol: unique[i],
        reason: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
      })
    }
  })

  return {
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance",
    quotes,
    failures,
  }
}
