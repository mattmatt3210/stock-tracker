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
import { currencySymbol, formatPercent, formatPrice, formatShortDate } from "@/lib/format"
import type { QuoteMap } from "@/lib/stocks"
import { cn } from "@/lib/utils"

const RANGES = [
  { key: "1m", label: "1 個月", days: 22 },
  { key: "3m", label: "3 個月", days: 64 },
  { key: "6m", label: "6 個月", days: 400 },
] as const

export type ChartTarget = {
  /** Yahoo 代碼 */
  symbol: string
  /** 報告裡的原始代碼，用於顯示 */
  label: string
  pivot: number | null
  stopLoss: number | null
}

type Props = {
  targets: ChartTarget[]
  quotes: QuoteMap
}

export function TrendChart({ targets, quotes }: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3m")
  const [symbol, setSymbol] = useState<string>(targets[0]?.symbol ?? "")

  const target = targets.find((t) => t.symbol === symbol) ?? targets[0]
  const quote = target ? quotes[target.symbol] : undefined
  const active = RANGES.find((item) => item.key === range) ?? RANGES[1]

  const data = useMemo(
    () => (quote ? quote.history.slice(-active.days) : []),
    [quote, active.days],
  )

  if (!target || !quote || data.length < 2) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">收盤走勢</h2>
        <p className="text-sm text-muted-foreground">目前沒有足夠的歷史資料可畫圖。</p>
      </section>
    )
  }

  const first = data[0].close
  const last = data.at(-1)!.close
  const periodChange = first ? ((last - first) / first) * 100 : 0
  const rising = periodChange >= 0
  const stroke = rising ? "var(--up)" : "var(--down)"
  const sym = currencySymbol(quote.currency)

  // 讓 pivot / 止蝕線也納入 Y 軸範圍，否則參考線會被裁掉
  const values = [...data.map((d) => d.close), target.pivot, target.stopLoss].filter(
    (v): v is number => typeof v === "number",
  )
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.12 || max * 0.02

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">收盤走勢</h2>
          <p className="text-xs text-muted-foreground">
            {quote.name} · {quote.exchange}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-xl leading-none tabular-nums">
              {sym}
              {formatPrice(last)}
            </div>
            <div
              className={cn("mt-1 font-mono text-xs tabular-nums", rising ? "text-up" : "text-down")}
            >
              區間 {formatPercent(periodChange)}
            </div>
          </div>
          <div
            className="flex overflow-hidden rounded-sm border border-border"
            role="group"
            aria-label="時間範圍"
          >
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                aria-pressed={range === item.key}
                className={cn(
                  "px-2.5 py-1 text-[11px] transition-colors",
                  range === item.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 代碼切換 */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="選擇股票">
        {targets.map((t) => (
          <button
            key={t.symbol}
            type="button"
            onClick={() => setSymbol(t.symbol)}
            aria-pressed={t.symbol === target.symbol}
            className={cn(
              "rounded border px-2 py-1 font-mono text-[11px] transition-colors",
              t.symbol === target.symbol
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

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
            {target.pivot !== null && (
              <ReferenceLine
                y={target.pivot}
                stroke="var(--trigger)"
                strokeDasharray="4 3"
                label={{
                  value: `樞紐 ${formatPrice(target.pivot)}`,
                  position: "insideTopLeft",
                  fill: "var(--trigger)",
                  fontSize: 10,
                }}
              />
            )}
            {target.stopLoss !== null && (
              <ReferenceLine
                y={target.stopLoss}
                stroke="var(--down)"
                strokeDasharray="4 3"
                label={{
                  value: `止蝕 ${formatPrice(target.stopLoss)}`,
                  position: "insideBottomLeft",
                  fill: "var(--down)",
                  fontSize: 10,
                }}
              />
            )}
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
              formatter={(value) => [`${sym}${formatPrice(Number(value))}`, "收盤"]}
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
