import type { ParsedReport, Setup, Position } from "./report-types"
import type { QuoteMap, StockQuote } from "./stocks"

/** 觸發狀態：達標 / 接近（2% 內）/ 等待 / 已破止蝕 */
export type PivotStatus = "triggered" | "near" | "waiting" | "stopped" | "unknown"

export interface SetupWithLive extends Setup {
  quote: StockQuote | null
  /** 現價距 pivot 的百分比（正 = 現價高於 pivot） */
  gapPct: number | null
  status: PivotStatus
  statusLabel: string
  /** 若現在觸發，距止蝕的風險金額 */
  riskAmount: number | null
}

const NEAR_THRESHOLD = 2 // %

export function evaluateSetup(setup: Setup, quotes: QuoteMap): SetupWithLive {
  const quote = (setup.yahooSymbol && quotes[setup.yahooSymbol]) || null

  if (!quote || setup.pivot === null) {
    return {
      ...setup,
      quote,
      gapPct: null,
      status: "unknown",
      statusLabel: quote ? "報告未列樞紐價" : "無即時報價",
      riskAmount: null,
    }
  }

  const price = quote.price
  const gapPct = ((price - setup.pivot) / setup.pivot) * 100

  let status: PivotStatus
  let statusLabel: string

  // 先檢查止蝕：若現價已低於止蝕位，無論方向都不應進場
  if (setup.stopLoss !== null && price <= setup.stopLoss) {
    status = "stopped"
    statusLabel = "已跌破止蝕位"
  } else if (setup.direction === "breakout") {
    // 突破買入：現價 ≥ pivot 即達標
    if (price >= setup.pivot) {
      status = "triggered"
      statusLabel = "已突破樞紐"
    } else if (Math.abs(gapPct) <= NEAR_THRESHOLD) {
      status = "near"
      statusLabel = `距突破 ${Math.abs(gapPct).toFixed(2)}%`
    } else {
      status = "waiting"
      statusLabel = `距突破 ${Math.abs(gapPct).toFixed(2)}%`
    }
  } else {
    // 回調買入：現價 ≤ pivot 即達標
    if (price <= setup.pivot) {
      status = "triggered"
      statusLabel = "已回落到樞紐"
    } else if (Math.abs(gapPct) <= NEAR_THRESHOLD) {
      status = "near"
      statusLabel = `距回測 ${Math.abs(gapPct).toFixed(2)}%`
    } else {
      status = "waiting"
      statusLabel = `距回測 ${Math.abs(gapPct).toFixed(2)}%`
    }
  }

  const riskAmount =
    setup.stopLoss !== null && setup.shares !== null
      ? (setup.pivot - setup.stopLoss) * setup.shares
      : null

  return { ...setup, quote, gapPct, status, statusLabel, riskAmount }
}

export interface PositionWithLive extends Position {
  quote: StockQuote | null
  /** 用即時價重算的損益百分比 */
  livePnlPct: number | null
  /** 用即時價重算的市值 */
  liveMarketValue: number | null
  /** 即時價相對報告收市價的變化 */
  driftPct: number | null
}

export function evaluatePosition(position: Position, quotes: QuoteMap): PositionWithLive {
  const quote = (position.yahooSymbol && quotes[position.yahooSymbol]) || null

  if (!quote) {
    return { ...position, quote: null, livePnlPct: null, liveMarketValue: null, driftPct: null }
  }

  const livePnlPct =
    position.cost !== null && position.cost !== 0
      ? ((quote.price - position.cost) / position.cost) * 100
      : null

  const liveMarketValue = position.shares !== null ? quote.price * position.shares : null

  const driftPct =
    position.reportPrice !== null && position.reportPrice !== 0
      ? ((quote.price - position.reportPrice) / position.reportPrice) * 100
      : null

  return { ...position, quote, livePnlPct, liveMarketValue, driftPct }
}

/** 報告中所有需要抓即時報價的 Yahoo 代碼 */
export function collectSymbols(report: ParsedReport): string[] {
  const out: string[] = []
  const push = (s: string | null) => {
    if (s) out.push(s)
  }

  report.positions.forEach((p) => push(p.yahooSymbol))
  report.setups.forEach((s) => push(s.yahooSymbol))
  // 已除牌 / 查不到的代碼不必再打 Yahoo
  report.corePool.filter((r) => !r.unavailable).forEach((r) => push(r.yahooSymbol))
  report.extendedPool.filter((r) => !r.unavailable).forEach((r) => push(r.yahooSymbol))
  report.market.indices.forEach((i) => push(i.symbol))

  return [...new Set(out)]
}

export const STATUS_ORDER: Record<PivotStatus, number> = {
  triggered: 0,
  near: 1,
  waiting: 2,
  stopped: 3,
  unknown: 4,
}
