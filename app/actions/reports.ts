"use server"

import { revalidatePath } from "next/cache"
import { refineReport, saveReport } from "@/lib/reports"

export type SubmitResult =
  | {
      ok: true
      id: number
      reportDate: string
      duplicate: boolean
      setups: number
      positions: number
    }
  | { ok: false; error: string }

/** 手動貼上報告（backfill 或測試用） */
export async function submitReport(rawText: string): Promise<SubmitResult> {
  if (!rawText.trim()) {
    return { ok: false, error: "請貼上報告內容" }
  }

  try {
    const { report, duplicate } = await saveReport(rawText, "manual")

    // 手動貼上時使用者正在等結果，直接等 LLM 抽完再回報，
    // 否則畫面會先閃一次 regex 的「0 個 setup」再跳動
    const refined = duplicate ? null : await refineReport(report.id).catch(() => null)
    const parsed = refined ?? report.parsed

    revalidatePath("/")
    return {
      ok: true,
      id: report.id,
      reportDate: parsed.reportDate ?? report.reportDate,
      duplicate,
      setups: parsed.setups.length,
      positions: parsed.positions.length,
    }
  } catch (error) {
    console.log("[v0] 手動儲存報告失敗:", error)
    return { ok: false, error: error instanceof Error ? error.message : "儲存失敗" }
  }
}
