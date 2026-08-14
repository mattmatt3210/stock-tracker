"use client"

import { useState } from "react"
import useSWR from "swr"
import { CronStatus } from "@/components/cron-status"
import { QuoteCard } from "@/components/quote-card"
import { RankingTable } from "@/components/ranking-table"
import { TickerTape } from "@/components/ticker-tape"
import { TrendChart } from "@/components/trend-chart"
import type { Snapshot } from "@/lib/stocks"
import { formatClock } from "@/lib/format"

const fetcher = async (url: string): Promise<Snapshot> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("讀取失敗")
  return res.json()
}

export function Dashboard({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const { data, isValidating, mutate } = useSWR<Snapshot>("/api/stocks", fetcher, {
    fallbackData: initialSnapshot,
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })

  const snapshot = data ?? initialSnapshot
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialSnapshot.quotes[0]?.symbol ?? "",
  )

  const selected =
    snapshot.quotes.find((quote) => quote.symbol === selectedSymbol) ?? snapshot.quotes[0]

  const advancing = snapshot.quotes.filter((quote) => quote.change > 0).length
  const declining = snapshot.quotes.filter((quote) => quote.change < 0).length

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">
              Daily Market Digest
            </span>
            <h1 className="text-2xl leading-none text-foreground text-balance">每日股市看板</h1>
            <p className="text-xs text-muted-foreground">
              美股與港股 · 每日排程自動更新 · 前端每分鐘輪詢一次
            </p>
          </div>

          <dl className="flex items-center gap-5 font-mono text-xs">
            <div className="flex flex-col gap-1">
              <dt className="text-[10px] text-muted-foreground">上漲</dt>
              <dd className="text-up">{advancing}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[10px] text-muted-foreground">下跌</dt>
              <dd className="text-down">{declining}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[10px] text-muted-foreground">同步於</dt>
              <dd className="text-foreground">{formatClock(snapshot.fetchedAt)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <TickerTape quotes={snapshot.quotes} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
        {snapshot.quotes.length === 0 ? (
          <p className="rounded-lg border border-down/40 bg-down/10 px-4 py-6 text-center text-sm text-down">
            目前無法取得任何股價資料，請稍後再試。
          </p>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {selected ? <TrendChart quote={selected} /> : null}
              <CronStatus snapshot={snapshot} isValidating={isValidating} onRefresh={() => mutate()} />
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm text-foreground">自選股報價</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {snapshot.quotes.map((quote) => (
                  <QuoteCard
                    key={quote.symbol}
                    quote={quote}
                    selected={quote.symbol === selected?.symbol}
                    onSelect={setSelectedSymbol}
                  />
                ))}
              </div>
            </section>

            <RankingTable
              quotes={snapshot.quotes}
              selectedSymbol={selected?.symbol ?? ""}
              onSelect={setSelectedSymbol}
            />
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 text-[11px] text-muted-foreground md:px-6">
          報價資料由 {snapshot.source} 提供，僅供參考，不構成投資建議。追蹤清單可於{" "}
          <code className="font-mono text-foreground">lib/watchlist.ts</code> 調整。
        </div>
      </footer>
    </div>
  )
}
