import { Badge } from "@/components/ui/badge"
import { formatPercent, formatPrice } from "@/lib/format"
import type { MarketState } from "@/lib/report-types"
import { cn } from "@/lib/utils"

const TONE_STYLE: Record<MarketState["verdictTone"], string> = {
  on: "bg-up text-up-foreground border-transparent",
  neutral: "bg-warn text-warn-foreground border-transparent",
  off: "bg-down text-down-foreground border-transparent",
}

export function MarketPanel({ market }: { market: MarketState }) {
  const notes = market.indices.map((i) => i.note).filter(Boolean)

  return (
    <section
      aria-labelledby="market-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="market-heading"
          className="text-sm font-semibold tracking-wide text-muted-foreground"
        >
          大市狀態
        </h2>
        {market.verdict && (
          <Badge className={cn("font-mono text-[11px]", TONE_STYLE[market.verdictTone])}>
            {market.verdict}
          </Badge>
        )}
      </div>

      {market.indices.length > 0 && (
        <ul className="flex flex-col gap-3">
          {market.indices.map((idx) => (
            <li
              key={idx.symbol}
              className="flex flex-col gap-1.5 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-base font-semibold">{idx.symbol}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {idx.stage2 ? "Stage 2 完整" : "Stage 2 不完整"}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-3 font-mono text-sm tabular-nums">
                  {idx.close !== null && <span>{formatPrice(idx.close)}</span>}
                  {idx.changePct !== null && (
                    <span
                      className={cn(
                        idx.changePct > 0 ? "text-up" : idx.changePct < 0 ? "text-down" : "",
                      )}
                    >
                      {formatPercent(idx.changePct)}
                    </span>
                  )}
                </div>
              </div>

              {(idx.ma50 !== null || idx.ma200 !== null) && (
                <dl className="flex gap-4 font-mono text-[11px] text-muted-foreground">
                  {idx.ma50 !== null && (
                    <div className="flex gap-1">
                      <dt>MA50</dt>
                      <dd className="tabular-nums">{formatPrice(idx.ma50)}</dd>
                    </div>
                  )}
                  {idx.ma200 !== null && (
                    <div className="flex gap-1">
                      <dt>MA200</dt>
                      <dd className="tabular-nums">{formatPrice(idx.ma200)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
