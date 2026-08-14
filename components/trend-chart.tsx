"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { StockQuote } from "@/lib/stocks"
import { currencySymbol, formatPercent, formatPrice, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const RANGES = [
  { key: "1m", label: "1 個月", days: 22 },
  { key: "3m", label: "3 個月", days: 64 },
  { key: "6m", label: "6 個月", days: 400 },
] as const

export function TrendChart({ quote }: { quote: StockQuote }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3m")

  const active = RANGES.find((item) => item.key === range) ?? RANGES[1]
  const data = useMemo(() => quote.history.slice(-active.days), [quote.history, active.days])

  const first = data[0]?.close ?? quote.price
  const last = data.at(-1)?.close ?? quote.price
  const periodChange = first ? ((last - first) / first) * 100 : 0
  const rising = periodChange >= 0
  const stroke = rising ? "var(--up)" : "var(--down)"

  const closes = data.map((point) => point.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const pad = (max - min) * 0.12 || max * 0.02

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-base text-foreground">{quote.symbol}</h2>
            <span className="text-sm text-muted-foreground">{quote.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {quote.name} · {quote.exchange} · 每日收盤價
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-xl leading-none text-foreground">
              {currencySymbol(quote.currency)}
              {formatPrice(last)}
            </div>
            <div className={cn("mt-1 font-mono text-xs", rising ? "text-up" : "text-down")}>
              區間 {formatPercent(periodChange)}
            </div>
          </div>
          <div className="flex overflow-hidden rounded-sm border border-border" role="group" aria-label="時間範圍">
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                aria-pressed={range === item.key}
                className={cn(
                  "px-2.5 py-1 text-[11px] transition-colors",
                  range === item.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={28}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(value: number) => formatPrice(value)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <ReferenceLine y={first} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }}
              itemStyle={{ color: "var(--foreground)", fontFamily: "var(--font-mono)" }}
              formatter={(value: number) => [
                `${currencySymbol(quote.currency)}${formatPrice(value)}`,
                "收盤",
              ]}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={stroke}
              strokeWidth={2}
              fill="url(#trend-fill)"
              dot={false}
              activeDot={{ r: 3, fill: stroke, stroke: "var(--background)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
