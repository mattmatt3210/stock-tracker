import type { StockQuote } from "@/lib/stocks"
import { formatPercent, formatPrice } from "@/lib/format"

function TapeRow({ quotes, ariaHidden }: { quotes: StockQuote[]; ariaHidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden}>
      {quotes.map((quote) => {
        const up = quote.change > 0
        const flat = quote.change === 0
        return (
          <div
            key={`${quote.symbol}-${ariaHidden ? "clone" : "main"}`}
            className="flex items-center gap-2 border-r border-border px-5 py-2 font-mono text-xs"
          >
            <span className="text-foreground">{quote.symbol}</span>
            <span className="text-muted-foreground">{formatPrice(quote.price)}</span>
            <span className={flat ? "text-muted-foreground" : up ? "text-up" : "text-down"}>
              {formatPercent(quote.changePercent)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function TickerTape({ quotes }: { quotes: StockQuote[] }) {
  if (quotes.length === 0) return null

  return (
    <div className="relative overflow-hidden border-y border-border bg-card">
      <div className="flex w-max animate-tape">
        <TapeRow quotes={quotes} />
        <TapeRow quotes={quotes} ariaHidden />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-card to-transparent" />
    </div>
  )
}
