import { WATCHLIST, type Market, type WatchlistItem } from "@/lib/watchlist"

export type HistoryPoint = {
  /** YYYY-MM-DD */
  date: string
  close: number
}

export type StockQuote = {
  symbol: string
  label: string
  name: string
  market: Market
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

export type Snapshot = {
  /** 這份資料被抓取的時間（ISO） */
  fetchedAt: string
  source: string
  quotes: StockQuote[]
  failures: { symbol: string; reason: string }[]
}

/** 走勢圖抓多久的日線 */
const RANGE = "6mo"

function toDateKey(seconds: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(seconds * 1000))
  return parts
}

async function fetchOne(item: WatchlistItem, revalidate: number | false): Promise<StockQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    item.symbol,
  )}?range=${RANGE}&interval=1d&includePrePost=false`

  const res = await fetch(url, {
    headers: {
      // Yahoo 對沒有 UA 的請求會擋掉
      "User-Agent": "Mozilla/5.0 (compatible; StockDashboard/1.0)",
      Accept: "application/json",
    },
    cache: revalidate === false ? "no-store" : undefined,
    next: revalidate === false ? undefined : { revalidate },
  })

  if (!res.ok) {
    throw new Error(`Yahoo 回應 ${res.status}`)
  }

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
  // 以前一根日線收盤作為比較基準，若無則退回 chartPreviousClose
  const previousClose: number =
    (history.length > 1 && history.at(-2)!.close) || meta.chartPreviousClose || price
  const change = price - previousClose

  return {
    symbol: item.symbol,
    label: item.label,
    name: meta.longName ?? meta.shortName ?? item.label,
    market: item.market,
    currency: meta.currency ?? (item.market === "HK" ? "HKD" : "USD"),
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
 * 抓取整份追蹤清單的快照。
 * @param revalidate 秒數；傳 false 代表完全不使用快取（cron 用）。
 */
export async function getSnapshot(revalidate: number | false = 300): Promise<Snapshot> {
  const settled = await Promise.allSettled(WATCHLIST.map((item) => fetchOne(item, revalidate)))

  const quotes: StockQuote[] = []
  const failures: Snapshot["failures"] = []

  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      quotes.push(entry.value)
    } else {
      failures.push({
        symbol: WATCHLIST[index].symbol,
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
