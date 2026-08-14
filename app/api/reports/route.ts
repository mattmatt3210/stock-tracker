import { NextResponse } from "next/server"
import { listReports, saveReport } from "@/lib/reports"

export const dynamic = "force-dynamic"

/**
 * Hermes Agent 每次跑完把報告 POST 過來。
 *
 * 支援兩種 body：
 *   text/plain          → 整個 body 就是報告文字
 *   application/json    → { "text": "..." } 或 { "report": "..." } 或 { "message": "..." }
 *
 * 驗證：header `x-webhook-secret` 或 `Authorization: Bearer <secret>`
 * 需與環境變數 REPORT_WEBHOOK_SECRET 相符。
 */
export async function POST(request: Request) {
  const secret = process.env.REPORT_WEBHOOK_SECRET

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "伺服器未設定 REPORT_WEBHOOK_SECRET，拒絕寫入" },
      { status: 503 },
    )
  }

  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""

  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "密鑰不符" }, { status: 401 })
  }

  let text = ""
  const contentType = request.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json()
      text =
        typeof body === "string"
          ? body
          : (body?.text ?? body?.report ?? body?.message ?? body?.content ?? "")
    } else {
      text = await request.text()
    }
  } catch {
    return NextResponse.json({ ok: false, error: "無法解析 request body" }, { status: 400 })
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ ok: false, error: "報告內容為空" }, { status: 400 })
  }

  try {
    const { report, duplicate } = await saveReport(text, "webhook")
    return NextResponse.json({
      ok: true,
      duplicate,
      id: report.id,
      reportDate: report.reportDate,
      parsed: {
        setups: report.parsed.setups.length,
        positions: report.parsed.positions.length,
        corePool: report.parsed.corePool.length,
        extendedPool: report.parsed.extendedPool.length,
      },
    })
  } catch (error) {
    console.log("[v0] webhook 儲存失敗:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "儲存失敗" },
      { status: 500 },
    )
  }
}

/** 歷史報告列表 */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, reports: await listReports() })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "讀取失敗" },
      { status: 500 },
    )
  }
}
