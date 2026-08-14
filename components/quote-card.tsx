"use client"

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Sparkline } from "@/components/sparkline"
import { MARKET_LABEL } from "@/lib/watchlist"
import type { StockQuote } from "@/lib/stocks"
import { currencySymbol, formatPercent, formatPrice, formatSigned, formatVolume } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  quote: StockQuote
  selected: boolean
  onSelect: (symbol: string) => void
}

export function QuoteCard({ quote, selected, onSelect }: Props) {
  const up = quote.change > 0
  const flat = quote.change === 0
  const tone = flat ? "text-muted-foreground" : up ? "text-up" : "text-down"
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight

  const range =
    quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh > quote.fiftyTwoWeekLow
      ? ((quote.price - quote.fiftyTwoWeekLow) / (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100
      : null

  return (
    <button
      type="button"
      onClick={() => onSelect(quote.symbol)}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col gap-4 rounded-lg border bg-card p-4 text-left transition-colors",
        selected ? "border-primary" : "border-border hover:border-muted-foreground/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm text-foreground">{quote.symbol}</span>
          <span className="text-xs text-muted-foreground">{quote.label}</span>
        </div>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground">
          {MARKET_LABEL[quote.market]}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-muted-foreground">{currencySymbol(quote.currency)}</span>
          <span className="font-mono text-2xl leading-none text-foreground">{formatPrice(quote.price)}</span>
        </div>
        <div className={cn("flex items-center gap-1.5 font-mono text-xs", tone)}>
          <Icon className="size-3.5" aria-hidden="true" />
          <span>{formatSigned(quote.change)}</span>
          <span className="text-muted-foreground">·</span>
          <span>{formatPercent(quote.changePercent)}</span>
        </div>
      </div>

      <Sparkline data={quote.history.slice(-30)} positive={!flat ? up : null} />

      <dl className="flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px]">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">成交量</dt>
          <dd className="font-mono text-foreground">{formatVolume(quote.volume)}</dd>
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <dt className="text-muted-foreground">52 週位置</dt>
          <dd className="font-mono text-foreground">{range === null ? "—" : `${range.toFixed(0)}%`}</dd>
        </div>
      </dl>
    </button>
  )
}
