"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { FileText } from "lucide-react"
import { HistoryPicker } from "@/components/history-picker"
import { MarketPanel } from "@/components/market-panel"
import { PasteReport } from "@/components/paste-report"
import { PoolGrid } from "@/components/pool-grid"
import { PositionsTable } from "@/components/positions-table"
import { ReportMeta } from "@/components/report-meta"
import { RequestsPanel } from "@/components/requests-panel"
import { SetupCard } from "@/components/setup-card"
import { TrendChart, type ChartTarget } from "@/components/trend-chart"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_ORDER, evaluatePosition, evaluateSetup } from "@/lib/pivot"
import type { ReportSummary, StoredReport } from "@/lib/reports"
import type { QuoteSnapshot } from "@/lib/stocks"

type DashboardData = {
  ok: boolean
  report: StoredReport | null
  quotes: QuoteSnapshot | null
  history: ReportSummary[]
  webhookProtected: boolean
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function Dashboard() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardData>(
    selectedId === null ? "/api/dashboard" : `/api/dashboard?id=${selectedId}`,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true, keepPreviousData: true },
  )

  const report = data?.report ?? null
  const quotes = data?.quotes ?? null
  const quoteMap = quotes?.quotes ?? {}

  const setups = useMemo(
    () =>
      report
        ? report.parsed.setups
            .map((s) => evaluateSetup(s, quoteMap))
            .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.rank - b.rank)
        : [],
    [report, quoteMap],
  )

  const positions = useMemo(
    () => (report ? report.parsed.positions.map((p) => evaluatePosition(p, quoteMap)) : []),
    [report, quoteMap],
  )

  // 圖表可選標的：setup 優先（帶樞紐與止蝕參考線），其次持倉
  const chartTargets = useMemo<ChartTarget[]>(() => {
    const out: ChartTarget[] = []
    const seen = new Set<string>()
    setups.forEach((s) => {
      if (s.yahooSymbol && quoteMap[s.yahooSymbol] && !seen.has(s.yahooSymbol)) {
        seen.add(s.yahooSymbol)
        out.push({
          symbol: s.yahooSymbol,
          label: s.rawTicker,
          pivot: s.pivot,
          stopLoss: s.stopLoss,
        })
      }
    })
    positions.forEach((p) => {
      if (p.yahooSymbol && quoteMap[p.yahooSymbol] && !seen.has(p.yahooSymbol)) {
        seen.add(p.yahooSymbol)
        out.push({ symbol: p.yahooSymbol, label: p.rawTicker, pivot: null, stopLoss: null })
      }
    })
    return out
  }, [setups, positions, quoteMap])

  const triggered = setups.filter((s) => s.status === "triggered" || s.status === "near").length

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }

  if (error || (data && !data.ok)) {
    return (
      <div className="rounded-lg border border-down/40 bg-down/10 p-5">
        <h2 className="text-sm font-semibold">讀取失敗</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "無法取得看板資料"}
        </p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border bg-card p-8">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold">還沒有任何報告</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            把 Hermes Agent 的報告 POST 到{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/reports</code>
            ，或直接貼上一份報告開始。
          </p>
        </div>
        <PasteReport onSaved={() => mutate()} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <HistoryPicker
        history={data?.history ?? []}
        activeId={selectedId}
        onSelect={(id) => setSelectedId(id)}
      />

      {/* A 級 Setup — 全頁重點 */}
      <section aria-labelledby="setups-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="setups-heading" className="text-base font-semibold">
            A 級 Setup
            {setups.length > 0 && (
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {triggered > 0 ? `${triggered} 個已達標或接近` : `${setups.length} 個追蹤中`}
              </span>
            )}
          </h2>
          <PasteReport onSaved={() => mutate()} />
        </div>

        {report.parsed.setupNotice && (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
            {report.parsed.setupNotice}
          </p>
        )}

        {setups.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {setups.map((s) => (
              <SetupCard key={`${s.rank}-${s.rawTicker}`} setup={s} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">這份報告沒有列出 A 級 setup。</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {chartTargets.length > 0 && <TrendChart targets={chartTargets} quotes={quoteMap} />}
          <PositionsTable positions={positions} totals={report.parsed.totals} />
          {(report.parsed.corePool.length > 0 || report.parsed.extendedPool.length > 0) && (
            <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
                Stage 2 覆核
              </h2>
              <PoolGrid heading="核心池" rows={report.parsed.corePool} quotes={quoteMap} />
              <PoolGrid heading="擴展池" rows={report.parsed.extendedPool} quotes={quoteMap} />
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <ReportMeta
            report={report}
            quotes={quotes}
            webhookProtected={data?.webhookProtected ?? false}
            isValidating={isValidating}
            onRefresh={() => mutate()}
          />
          <MarketPanel market={report.parsed.market} />
          <RequestsPanel report={report.parsed} />
        </aside>
      </div>

      {/* 原始報告 */}
      <section className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw((v) => !v)}
          className="w-fit gap-1.5 text-xs"
        >
          <FileText className="size-3.5" aria-hidden />
          {showRaw ? "隱藏原始報告" : "顯示原始報告"}
        </Button>
        {showRaw && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-5 font-mono text-xs leading-relaxed text-muted-foreground">
            {report.rawText}
          </pre>
        )}
      </section>
    </div>
  )
}
