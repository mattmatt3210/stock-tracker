import { NextResponse } from "next/server"
import { collectSymbols } from "@/lib/pivot"
import { getLatestReport, getReportById, listReports } from "@/lib/reports"
import { getQuotes } from "@/lib/stocks"

export const dynamic = "force-dynamic"

/**
 * 看板主資料：報告 + 即時報價。
 * ?id=<n> 可指定某一份歷史報告，預設取最新。
 */
export async function GET(request: Request) {
  try {
    const idParam = new URL(request.url).searchParams.get("id")
    const id = idParam ? Number.parseInt(idParam, 10) : null

    const [report, history] = await Promise.all([
      id !== null && Number.isFinite(id) ? getReportById(id) : getLatestReport(),
      listReports(),
    ])

    const webhookProtected = Boolean(process.env.REPORT_WEBHOOK_SECRET)

    if (!report) {
      return NextResponse.json({
        ok: true,
        report: null,
        quotes: null,
        history,
        webhookProtected,
      })
    }

    const symbols = collectSymbols(report.parsed)
    const quotes = await getQuotes(symbols)

    return NextResponse.json({ ok: true, report, quotes, history, webhookProtected })
  } catch (error) {
    console.log("[v0] 看板資料讀取失敗:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "讀取失敗" },
      { status: 500 },
    )
  }
}
