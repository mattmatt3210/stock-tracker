import type { ParsedReport } from "@/lib/report-types"

export function RequestsPanel({ report }: { report: ParsedReport }) {
  const { requests, orderCommands, footnotes } = report
  if (requests.length === 0 && orderCommands.length === 0 && footnotes.length === 0) return null

  return (
    <section
      aria-labelledby="requests-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="requests-heading"
          className="text-sm font-semibold tracking-wide text-muted-foreground"
        >
          請示落單
        </h2>
        <p className="text-[11px] text-muted-foreground">
          此頁只顯示報告內容，不會代為下單。請回到 Hermes Agent 執行。
        </p>
      </div>

      {requests.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          {requests.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {orderCommands.length > 0 && (
        <dl className="flex flex-col gap-2 border-t border-border pt-3">
          {orderCommands.map((c, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <dt className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                {c.command}
              </dt>
              <dd className="text-muted-foreground">{c.description}</dd>
            </div>
          ))}
        </dl>
      )}

      {footnotes.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {footnotes.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
