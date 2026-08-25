"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatRelative } from "@/lib/format"
import type { StoredReport } from "@/lib/reports"
import type { QuoteSnapshot } from "@/lib/stocks"
import { cn } from "@/lib/utils"

const PARSE_LABEL: Record<string, string> = {
  llm: "LLM 抽取",
  regex: "規則式（LLM 失敗）",
  pending: "處理中…",
}

type Props = {
  report: StoredReport
  quotes: QuoteSnapshot | null
  webhookProtected: boolean
  isValidating: boolean
  onRefresh: () => void
}

export function ReportMeta({ report, quotes, webhookProtected, isValidating, onRefresh }: Props) {
  // 相對時間只在瀏覽器計算，避免 server / client 字串不同造成 hydration 錯誤
  const [rel, setRel] = useState<{ report: string; quotes: string | null } | null>(null)

  useEffect(() => {
    function tick() {
      setRel({
        report: formatRelative(report.receivedAt),
        quotes: quotes ? formatRelative(quotes.fetchedAt) : null,
      })
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [report.receivedAt, quotes?.fetchedAt, quotes])

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">資料狀態</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isValidating}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          <RefreshCw className={cn("size-3", isValidating && "animate-spin")} aria-hidden />
          {isValidating ? "更新中" : "重新整理"}
        </Button>
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        <Row
          label="報告日期"
          value={report.parsed.dateLabel ?? report.reportDate}
        />
        <Row
          label="報告收到"
          value={`${formatDateTime(report.receivedAt)}${rel ? ` (${rel.report})` : ""}`}
        />
        <Row
          label="來源"
          value={report.source === "webhook" ? "Webhook 自動推送" : "手動貼上"}
        />
        {report.jobId && <Row label="Job ID" value={report.jobId} mono />}
        <Row
          label="即時報價"
          value={
            quotes
              ? `${formatDateTime(quotes.fetchedAt)}${rel?.quotes ? ` (${rel.quotes})` : ""} · ${quotes.source}`
              : "未取得"
          }
        />
        <Row label="解析方式" value={PARSE_LABEL[report.parseMethod] ?? report.parseMethod} />
      </dl>

      {report.parseMethod === "regex" && (
        <div className="flex gap-2 rounded-md border border-warn/40 bg-warn/10 p-3">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            LLM 抽取失敗，目前顯示的是規則式解析結果，可能有遺漏。
            {report.parseError ? ` 原因：${report.parseError}` : ""}
          </p>
        </div>
      )}

      {report.parseMethod === "pending" && (
        <div className="flex gap-2 rounded-md border border-border bg-muted/40 p-3">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            報告已收到，正在用 LLM 抽取結構化內容，稍後重新整理即可看到完整結果。
          </p>
        </div>
      )}

      {quotes && quotes.failures.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-warn/40 bg-warn/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="size-3.5 text-warn" aria-hidden />
            {quotes.failures.length} 個代碼取不到即時價
          </div>
          <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
            {quotes.failures.map((f) => (
              <li key={f.symbol}>
                {f.symbol} — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {webhookProtected ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
          <ShieldCheck className="size-3.5 shrink-0 text-pos" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Webhook 已啟用密鑰驗證，未帶正確密鑰的請求會被拒絕。
          </p>
        </div>
      ) : (
        <div className="flex gap-2 rounded-md border border-border bg-muted/40 p-3">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Webhook 端點目前未設密鑰，任何人知道網址都能推送報告。設定環境變數{" "}
            <code className="font-mono text-foreground">REPORT_WEBHOOK_SECRET</code> 後會自動啟用驗證。
          </p>
        </div>
      )}

      {report.parsed.alerts.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {report.parsed.alerts.map((a, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed">
              <Badge variant="outline" className="h-fit shrink-0 text-[10px]">
                提示
              </Badge>
              <span className="text-muted-foreground">{a}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-right tabular-nums", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  )
}
