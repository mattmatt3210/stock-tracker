"use client"

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts"
import type { HistoryPoint } from "@/lib/stocks"

type Props = {
  data: HistoryPoint[]
  /** true 漲、false 跌、null 平盤 */
  positive: boolean | null
}

export function Sparkline({ data, positive }: Props) {
  if (data.length < 2) {
    return <div className="h-10" />
  }

  const stroke =
    positive === null ? "var(--muted-foreground)" : positive ? "var(--up)" : "var(--down)"

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
