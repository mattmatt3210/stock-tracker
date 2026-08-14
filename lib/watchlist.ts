export type Market = "US" | "HK"

export type WatchlistItem = {
  symbol: string
  label: string
  market: Market
}

/**
 * 追蹤清單。symbol 使用 Yahoo Finance 格式：
 *  - 美股：AAPL、NVDA
 *  - 港股：0700.HK（四位數 + .HK）
 */
export const WATCHLIST: WatchlistItem[] = [
  { symbol: "NVDA", label: "輝達", market: "US" },
  { symbol: "AAPL", label: "蘋果", market: "US" },
  { symbol: "MSFT", label: "微軟", market: "US" },
  { symbol: "GOOGL", label: "Alphabet", market: "US" },
  { symbol: "AMZN", label: "亞馬遜", market: "US" },
  { symbol: "TSLA", label: "特斯拉", market: "US" },
  { symbol: "0700.HK", label: "騰訊控股", market: "HK" },
  { symbol: "9988.HK", label: "阿里巴巴", market: "HK" },
  { symbol: "3690.HK", label: "美團", market: "HK" },
  { symbol: "0005.HK", label: "滙豐控股", market: "HK" },
  { symbol: "1299.HK", label: "友邦保險", market: "HK" },
  { symbol: "0388.HK", label: "港交所", market: "HK" },
]

export const MARKET_LABEL: Record<Market, string> = {
  US: "美股",
  HK: "港股",
}
