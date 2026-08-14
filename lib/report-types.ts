// Hermes Agent 掃描報告解析後的結構

/** 買入方向：報告的「請示」段會寫明是等回測（≤ pivot）還是等突破（≥ pivot） */
export type PivotDirection = "breakout" | "pullback"

export interface MarketIndex {
  symbol: string
  close: number | null
  changePct: number | null
  ma50: number | null
  ma200: number | null
  stage2: boolean
  note: string
}

export interface MarketState {
  indices: MarketIndex[]
  /** risk-on / risk-off / 其他判定文字 */
  verdict: string | null
  verdictTone: "on" | "off" | "neutral"
}

export interface Position {
  /** 報告原始代碼，例如 HK.01888 */
  rawTicker: string
  /** Yahoo 代碼，例如 1888.HK */
  yahooSymbol: string | null
  name: string
  shares: number | null
  cost: number | null
  reportPrice: number | null
  pnlPct: number | null
  marketValue: number | null
  currency: string | null
  note: string
}

export interface PortfolioTotals {
  label: string
  value: string
}

export interface ScanRow {
  rawTicker: string
  yahooSymbol: string | null
  close: number | null
  changePct: number | null
  stage2: string
  stage2Ok: boolean
  note: string
  /** 代碼查不到 / 已除牌 */
  unavailable: boolean
}

export interface Setup {
  rank: number
  rawTicker: string
  yahooSymbol: string | null
  name: string
  /** 例如「等回測 50MA」 */
  condition: string
  direction: PivotDirection
  pivot: number | null
  stopLoss: number | null
  shares: number | null
  notional: number | null
  weightPct: number | null
  rationale: string
  /** 對應「回『落 LITE』」的指令字串 */
  orderCommand: string | null
}

export interface ReportSection {
  heading: string
  lines: string[]
}

export interface ParsedReport {
  jobId: string | null
  title: string | null
  /** ISO date, 例如 2026-08-14 */
  reportDate: string | null
  dateLabel: string | null
  alerts: string[]
  market: MarketState
  positions: Position[]
  totals: PortfolioTotals[]
  corePool: ScanRow[]
  extendedPool: ScanRow[]
  setups: Setup[]
  setupNotice: string | null
  requests: string[]
  orderCommands: { command: string; description: string }[]
  footnotes: string[]
  /** 無法歸類的原始段落，保留以免資訊遺失 */
  extraSections: ReportSection[]
}
