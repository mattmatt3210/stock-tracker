import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { listReports, ReportValidationError, saveReport } from "@/lib/reports"

export const dynamic = "force-dynamic"

/**
 * 定時安全比對，避免用 !== 逐字元短路而洩漏密鑰長度以外的資訊。
 * timingSafeEqual 要求兩邊長度相同，否則會丟錯，所以先比長度。
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Hermes Agent 每次跑完把報告 POST 過來。
 *
 * 支援兩種 body：
 *   text/plain          → 整個 body 就是報告文字
 *   application/json    → { "text": "..." } 或 { "report": "..." } 或 { "message": "..." }
 *
 * 驗證：若已設定環境變數 REPORT_WEBHOOK_SECRET，則要求 header
 * `x-webhook-secret` 或 `Authorization: Bearer <secret>` 相符。
 * 未設定時端點開放（方便先接上），回應會帶 unprotected 旗標提醒。
 */
export async function POST(request: Request) {
  const secret = process.env.REPORT_WEBHOOK_SECRET

  if (secret) {
    const provided = (
      request.headers.get("x-webhook-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      ""
    ).trim()

    if (!secretMatches(provided, secret.trim())) {
      return NextResponse.json({ ok: false, error: "密鑰不符" }, { status: 401 })
    }
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
      unprotected: !secret || undefined,
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
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 })
    }
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
