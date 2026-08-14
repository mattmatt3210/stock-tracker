"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MARKET_LABEL, type Market } from "@/lib/watchlist"
import type { StockQuote } from "@/lib/stocks"
import { currencySymbol, formatPercent, formatPrice, formatSigned, formatVolume } from "@/lib/format"
import { cn } from "@/lib/utils"

type SortKey = "changePercent" | "price" | "volume"

const MARKET_FILTERS: { key: "ALL" | Market; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "US", label: MARKET_LABEL.US },
  { key: "HK", label: MARKET_LABEL.HK },
]

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "price", label: "收盤價" },
  { key: "changePercent", label: "漲跌幅" },
  { key: "volume", label: "成交量" },
]

type Props = {
  quotes: StockQuote[]
  selectedSymbol: string
  onSelect: (symbol: string) => void
}

export function RankingTable({ quotes, selectedSymbol, onSelect }: Props) {
  const [market, setMarket] = useState<"ALL" | Market>("ALL")
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("changePercent")
  const [descending, setDescending] = useState(true)

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = quotes.filter((quote) => {
      const marketMatch = market === "ALL" || quote.market === market
      const keywordMatch =
        keyword.length === 0 ||
        quote.symbol.toLowerCase().includes(keyword) ||
        quote.label.toLowerCase().includes(keyword) ||
        quote.name.toLowerCase().includes(keyword)
      return marketMatch && keywordMatch
    })

    return [...filtered].sort((a, b) => {
      const valueA = sortKey === "volume" ? (a.volume ?? 0) : a[sortKey]
      const valueB = sortKey === "volume" ? (b.volume ?? 0) : b[sortKey]
      return descending ? valueB - valueA : valueA - valueB
    })
  }, [quotes, market, query, sortKey, descending])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((value) => !value)
      return
    }
    setSortKey(key)
    setDescending(true)
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm text-foreground">漲跌排行</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-sm border border-border" role="group" aria-label="市場篩選">
            {MARKET_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMarket(item.key)}
                aria-pressed={market === item.key}
                className={cn(
                  "px-2.5 py-1 text-[11px] transition-colors",
                  market === item.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋代號或名稱"
              aria-label="搜尋代號或名稱"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-left font-normal">
                代號
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" className="py-2 pl-3 text-right font-normal">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    aria-label={`依${column.label}排序`}
                  >
                    {column.label}
                    {sortKey === column.key ? (
                      descending ? (
                        <ArrowDown className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowUp className="size-3" aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((quote) => {
              const up = quote.change > 0
              const flat = quote.change === 0
              const tone = flat ? "text-muted-foreground" : up ? "text-up" : "text-down"
              return (
                <tr
                  key={quote.symbol}
                  onClick={() => onSelect(quote.symbol)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50",
                    selectedSymbol === quote.symbol && "bg-accent/60",
                  )}
                >
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground">{quote.symbol}</span>
                      <span className="text-xs text-muted-foreground">{quote.label}</span>
                    </div>
                  </th>
                  <td className="py-2.5 pl-3 text-right font-mono text-xs text-foreground">
                    <span className="text-[10px] text-muted-foreground">
                      {currencySymbol(quote.currency)}
                    </span>
                    {formatPrice(quote.price)}
                  </td>
                  <td className={cn("py-2.5 pl-3 text-right font-mono text-xs", tone)}>
                    <div className="flex flex-col items-end">
                      <span>{formatPercent(quote.changePercent)}</span>
                      <span className="text-[10px] opacity-70">{formatSigned(quote.change)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-xs text-muted-foreground">
                    {formatVolume(quote.volume)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">沒有符合條件的股票</p>
        ) : null}
      </div>
    </section>
  )
}
