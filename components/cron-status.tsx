"use client"

import { useEffect, useState } from "react"
import { CircleAlert, CircleCheck, RefreshCw } from "lucide-react"
import { CRON_RUNS, nextRunAt } from "@/lib/cron-schedule"
import type { Snapshot } from "@/lib/stocks"
import { formatCountdown, formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  snapshot: Snapshot
  isValidating: boolean
  onRefresh: () => void
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-xs text-foreground", tone)}>{value}</dd>
    </div>
  )
}

export function CronStatus({ snapshot, isValidating, onRefresh }: Props) {
  const [countdown, setCountdown] = useState<string>("--:--:--")
  const [nextLabel, setNextLabel] = useState<string>("")
  // 相對時間只在瀏覽器計算，避免 server / client 渲染出不同字串造成 hydration 錯誤
  const [relative, setRelative] = useState<string | null>(null)

  useEffect(() => {
    function tick() {
      const next = nextRunAt()
      setCountdown(formatCountdown(next.at))
      setNextLabel(`${next.label} · ${formatDateTime(next.at)}`)
      setRelative(formatRelative(snapshot.fetchedAt))
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [snapshot.fetchedAt])

  const healthy = snapshot.failures.length === 0
  const latestMarketTime = snapshot.quotes.reduce<number | null>(
    (latest, quote) => (quote.marketTime && (!latest || quote.marketTime > latest) ? quote.marketTime : latest),
    null,
  )

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm text-foreground">排程狀態</h2>
          <p className="text-xs text-muted-foreground">Vercel Cron · /api/cron/stocks</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn("size-3.5", isValidating && "animate-spin")} aria-hidden="true" />
          {isValidating ? "更新中" : "立即更新"}
        </button>
      </header>

      <div
        className={cn(
          "flex items-center gap-2 rounded-sm border px-3 py-2 text-xs",
          healthy ? "border-up/40 bg-up/10 text-up" : "border-down/40 bg-down/10 text-down",
        )}
      >
        {healthy ? (
          <CircleCheck className="size-4" aria-hidden="true" />
        ) : (
          <CircleAlert className="size-4" aria-hidden="true" />
        )}
        <span>
          {healthy
            ? `全部 ${snapshot.quotes.length} 檔抓取成功`
            : `${snapshot.failures.length} 檔抓取失敗 / 共 ${snapshot.quotes.length + snapshot.failures.length} 檔`}
        </span>
      </div>

      <dl className="flex flex-col">
        <Row label="資料來源" value={snapshot.source} />
        <Row
          label="最後更新"
          value={
            relative
              ? `${formatDateTime(snapshot.fetchedAt)} (${relative})`
              : formatDateTime(snapshot.fetchedAt)
          }
        />
        <Row
          label="最新成交時間"
          value={latestMarketTime ? formatDateTime(latestMarketTime) : "—"}
        />
        <Row label="下次排程" value={nextLabel || "—"} />
        <Row label="倒數" value={countdown} tone="text-primary" />
      </dl>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">每日排程時間（台北時間）</span>
        {CRON_RUNS.map((run) => {
          const sample = new Date(Date.UTC(2024, 0, 1, run.utcHour, run.utcMinute))
          return (
            <div key={run.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{run.label}</span>
              <span className="font-mono text-foreground">
                {new Intl.DateTimeFormat("zh-Hant", {
                  timeZone: "Asia/Taipei",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(sample)}
              </span>
            </div>
          )
        })}
      </div>

      {snapshot.failures.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {snapshot.failures.map((failure) => (
            <li key={failure.symbol} className="text-[11px] text-down">
              <span className="font-mono">{failure.symbol}</span> — {failure.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
