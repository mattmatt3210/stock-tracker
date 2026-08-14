"use client"

import { formatDateTime } from "@/lib/format"
import type { ReportSummary } from "@/lib/reports"
import { cn } from "@/lib/utils"

type Props = {
  history: ReportSummary[]
  activeId: number | null
  onSelect: (id: number | null) => void
}

export function HistoryPicker({ history, activeId, onSelect }: Props) {
  if (history.length <= 1) return null

  const latestId = history[0]?.id ?? null

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-2">
      <h2 id="history-heading" className="text-xs font-semibold tracking-wide text-muted-foreground">
        歷史報告
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {history.map((h) => {
          const active = activeId === null ? h.id === latestId : h.id === activeId
          return (
            <li key={h.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(h.id === latestId ? null : h.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="font-mono text-xs font-semibold tabular-nums">{h.reportDate}</span>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    active ? "text-background/70" : "text-muted-foreground",
                  )}
                >
                  {h.setupCount} setup · {formatDateTime(h.receivedAt)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
