import { Badge } from "@/components/ui/badge"
import { formatPercent, formatPrice } from "@/lib/format"
import type { ScanRow } from "@/lib/report-types"
import type { QuoteMap } from "@/lib/stocks"
import { cn } from "@/lib/utils"

type Props = {
  heading: string
  rows: ScanRow[]
  quotes: QuoteMap
  /** 該區塊的說明（例如「暫無 A 級 setup」的前置條件說明） */
  notice?: string | null
}

export function PoolGrid({ heading, rows, quotes, notice }: Props) {
  if (rows.length === 0) return null

  const passed = rows.filter((r) => r.stage2Ok).length

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">{heading}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {passed}/{rows.length} 通過 Stage 2
        </span>
      </div>

      {notice && <p className="text-xs leading-relaxed text-muted-foreground">{notice}</p>}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => {
          const quote = row.yahooSymbol ? quotes[row.yahooSymbol] : undefined
          const live = quote?.changePercent ?? null

          return (
            <li
              key={row.rawTicker}
              className={cn(
                "flex flex-col gap-1.5 rounded-md border p-3",
                row.unavailable
                  ? "border-dashed border-border bg-muted/30"
                  : row.stage2Ok
                    ? "border-border bg-card"
                    : "border-border bg-card opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">{row.rawTicker}</span>
                {row.unavailable ? (
                  <Badge variant="outline" className="text-[10px]">
                    無資料
                  </Badge>
                ) : (
                  <span
                    title={row.stage2 || undefined}
                    aria-label={row.stage2Ok ? "通過 Stage 2" : "未通過 Stage 2"}
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      row.stage2Ok ? "bg-trigger" : "bg-muted-foreground/40",
                    )}
                  />
                )}
              </div>

              <div className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
                <span className="text-muted-foreground">
                  {row.close !== null ? formatPrice(row.close) : "—"}
                </span>
                {row.changePct !== null && (
                  <span
                    className={cn(
                      row.changePct > 0 ? "text-up" : row.changePct < 0 ? "text-down" : "",
                    )}
                  >
                    {formatPercent(row.changePct)}
                  </span>
                )}
              </div>

              {live !== null && (
                <div className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5 font-mono text-xs tabular-nums">
                  <span className="text-[10px] text-muted-foreground">即時</span>
                  <span className={cn(live > 0 ? "text-up" : live < 0 ? "text-down" : "")}>
                    {formatPercent(live)}
                  </span>
                </div>
              )}

              {row.note && (
                <p className="text-[11px] leading-snug text-muted-foreground">{row.note}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
