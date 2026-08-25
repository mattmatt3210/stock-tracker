"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkline } from "@/components/sparkline"
import { currencySymbol, formatPercent, formatPrice } from "@/lib/format"
import type { PivotStatus, SetupWithLive } from "@/lib/pivot"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<PivotStatus, { badge: string; rail: string }> = {
  triggered: { badge: "bg-trigger text-trigger-foreground border-transparent", rail: "bg-trigger" },
  near: { badge: "bg-warn text-warn-foreground border-transparent", rail: "bg-warn" },
  waiting: { badge: "bg-muted text-muted-foreground border-transparent", rail: "bg-border" },
  stopped: { badge: "bg-down text-down-foreground border-transparent", rail: "bg-down" },
  unknown: { badge: "bg-muted text-muted-foreground border-transparent", rail: "bg-border" },
}

/**
 * setup 等級標籤。A 級不標（是預設狀態），
 * 觀望與 watchlist 一定要標出來，否則會被誤當成可立即執行。
 */
const TIER_LABEL: Record<string, { text: string; className: string } | undefined> = {
  a: undefined,
  watch: { text: "觀望", className: "border-warn/50 text-warn" },
  monitor: { text: "僅監察", className: "border-border text-muted-foreground" },
}

/** 樞紐在軌上的固定位置；留 1/3 空間給衝過樞紐的情況 */
const PIVOT_ANCHOR = 66.7

/**
 * 距離軌採固定刻度：止蝕 = 0%、樞紐 = PIVOT_ANCHOR%。
 * 刻度不隨現價浮動，否則現價高於樞紐時 high 會被現價撐大，
 * marker 永遠貼在 100%（回調型 setup 尤其明顯）。
 */
function railPosition(setup: SetupWithLive): number | null {
  const { quote, pivot, stopLoss } = setup
  if (!quote || pivot === null) return null
  const low = stopLoss !== null && stopLoss < pivot ? stopLoss : pivot * 0.9
  const span = pivot - low
  if (span <= 0) return null
  const pct = ((quote.price - low) / span) * PIVOT_ANCHOR
  return Math.min(100, Math.max(0, pct))
}

export function SetupCard({ setup }: { setup: SetupWithLive }) {
  const [copied, setCopied] = useState(false)
  const style = STATUS_STYLE[setup.status]
  // 報告代碼前綴（HK. / US.）決定幣別，取不到即時報價時作為後備
  const isHK = /^HK\./i.test(setup.rawTicker) || setup.yahooSymbol?.endsWith(".HK")
  const sym = currencySymbol(setup.quote?.currency ?? (isHK ? "HKD" : "USD"))
  const pos = railPosition(setup)
  const tierLabel = TIER_LABEL[setup.tier]

  async function copyCommand() {
    if (!setup.orderCommand) return
    try {
      await navigator.clipboard.writeText(setup.orderCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", style.rail)} />

      <header className="flex items-start justify-between gap-3 border-b border-border p-4 pl-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              #{setup.rank}
            </span>
            <h3 className="font-mono text-lg font-semibold tracking-tight">{setup.rawTicker}</h3>
            <Badge variant="outline" className="font-mono text-[10px]">
              {isHK ? "HK" : "US"}
            </Badge>
            {tierLabel && (
              <Badge variant="outline" className={cn("text-[10px]", tierLabel.className)}>
                {tierLabel.text}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{setup.name}</p>
        </div>
        <Badge className={cn("shrink-0 font-mono text-[11px]", style.badge)}>
          {setup.statusLabel}
        </Badge>
      </header>

      <div className="flex flex-col gap-4 p-4 pl-5">
        {/* 現價 vs 樞紐 */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">現價</span>
            {setup.quote ? (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {sym}
                  {formatPrice(setup.quote.price)}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    setup.quote.changePercent > 0
                      ? "text-up"
                      : setup.quote.changePercent < 0
                        ? "text-down"
                        : "text-muted-foreground",
                  )}
                >
                  {formatPercent(setup.quote.changePercent)}
                </span>
              </div>
            ) : (
              <span className="font-mono text-2xl text-muted-foreground">—</span>
            )}
          </div>
          {setup.quote && setup.quote.history.length > 1 && (
            <div className="w-28 shrink-0">
              <Sparkline
                data={setup.quote.history.slice(-60)}
                positive={setup.quote.changePercent >= 0}
              />
            </div>
          )}
        </div>

        {/* 距離軌：止蝕 ← 現價 → 樞紐 */}
        {pos !== null && (
          <div className="flex flex-col gap-1.5">
            <div className="relative h-1.5 rounded-full bg-muted">
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 rounded-full", style.rail)}
                style={{ width: `${pos}%` }}
              />
              {/* 樞紐固定參考線 */}
              <span
                aria-hidden
                className="absolute -inset-y-1 w-px bg-foreground/45"
                style={{ left: `${PIVOT_ANCHOR}%` }}
              />
              <span
                aria-hidden
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
                style={{ left: `${pos}%` }}
              />
            </div>
            <div className="relative font-mono text-[10px] text-muted-foreground">
              <span>止蝕 {setup.stopLoss !== null ? formatPrice(setup.stopLoss) : "—"}</span>
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${PIVOT_ANCHOR}%` }}
              >
                樞紐 {setup.pivot !== null ? formatPrice(setup.pivot) : "—"}
              </span>
            </div>
          </div>
        )}

        {/* 報告參數 */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
          <Field label="進場條件" value={setup.condition ?? "—"} mono={false} />
          <Field
            label="方向"
            value={setup.direction === "breakout" ? "突破買入" : "回調買入"}
            mono={false}
          />
          <Field
            label="建議股數"
            value={setup.shares !== null ? `${setup.shares.toLocaleString("zh-Hant")} 股` : "—"}
          />
          <Field
            label="名義金額"
            value={
              setup.notional !== null
                ? `${sym}${setup.notional.toLocaleString("zh-Hant")}`
                : "—"
            }
          />
          {setup.weightPct !== null && (
            <Field label="組合佔比" value={`${setup.weightPct}%`} />
          )}
          {setup.riskAmount !== null && (
            <Field
              label="樞紐→止蝕風險"
              value={`${sym}${Math.abs(setup.riskAmount).toLocaleString("zh-Hant", {
                maximumFractionDigits: 0,
              })}`}
            />
          )}
        </dl>

        {setup.rationale && (
          <p className="border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
            {setup.rationale}
          </p>
        )}

        {setup.orderCommand && (
          <Button
            variant="outline"
            size="sm"
            onClick={copyCommand}
            className="w-full justify-center gap-2 font-mono"
          >
            {copied ? (
              <>
                <Check className="size-3.5" aria-hidden />
                已複製
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden />
                複製「{setup.orderCommand}」
              </>
            )}
          </Button>
        )}
      </div>
    </article>
  )
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", mono ? "font-mono" : "")}>{value}</dd>
    </div>
  )
}
