import { Badge } from "@/components/ui/badge"
import { currencySymbol, formatPercent, formatPrice } from "@/lib/format"
import type { PositionWithLive } from "@/lib/pivot"
import type { PortfolioTotals } from "@/lib/report-types"
import { cn } from "@/lib/utils"

function pnlClass(v: number | null): string {
  if (v === null) return "text-muted-foreground"
  return v > 0 ? "text-up" : v < 0 ? "text-down" : ""
}

export function PositionsTable({
  positions,
  totals,
}: {
  positions: PositionWithLive[]
  totals: PortfolioTotals[]
}) {
  if (positions.length === 0) return null

  return (
    <section
      aria-labelledby="positions-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="positions-heading"
          className="text-sm font-semibold tracking-wide text-muted-foreground"
        >
          現倉檢討
        </h2>
        <span className="font-mono text-xs text-muted-foreground">{positions.length} 個持倉</span>
      </div>

      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="pb-2 pr-3 font-medium">
                代碼
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                股數
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                成本
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                報告價
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                現價
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                報告損益
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                即時損益
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                即時市值
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const sym = currencySymbol(p.currency ?? p.quote?.currency ?? "USD")
              return (
                <tr key={p.rawTicker} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-3 pr-3 text-left font-normal">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{p.rawTicker}</span>
                        {p.driftPct !== null && Math.abs(p.driftPct) >= 0.05 && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            報告後 {formatPercent(p.driftPct)}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{p.name}</span>
                    </div>
                  </th>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums">
                    {p.shares?.toLocaleString("zh-Hant") ?? "—"}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {p.cost !== null ? formatPrice(p.cost) : "—"}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {p.reportPrice !== null ? formatPrice(p.reportPrice) : "—"}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums">
                    {p.quote ? formatPrice(p.quote.price) : "—"}
                  </td>
                  <td
                    className={cn(
                      "py-3 pr-3 text-right font-mono tabular-nums",
                      pnlClass(p.pnlPct),
                    )}
                  >
                    {p.pnlPct !== null ? formatPercent(p.pnlPct) : "—"}
                  </td>
                  <td
                    className={cn(
                      "py-3 pr-3 text-right font-mono font-semibold tabular-nums",
                      pnlClass(p.livePnlPct),
                    )}
                  >
                    {p.livePnlPct !== null ? formatPercent(p.livePnlPct) : "—"}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {p.liveMarketValue !== null
                      ? `${sym}${p.liveMarketValue.toLocaleString("zh-Hant", {
                          maximumFractionDigits: 0,
                        })}`
                      : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {positions.some((p) => p.note) && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {positions
            .filter((p) => p.note)
            .map((p) => (
              <li key={p.rawTicker}>
                <span className="font-mono font-medium text-foreground">{p.rawTicker}</span>{" "}
                {p.note}
              </li>
            ))}
        </ul>
      )}

      {totals.length > 0 && (
        <dl className="flex flex-col gap-2 border-t border-border pt-3">
          {totals.map((t, i) => (
            <div key={i} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <dt className="text-muted-foreground">{t.label}</dt>
              <dd className="font-mono font-semibold tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
