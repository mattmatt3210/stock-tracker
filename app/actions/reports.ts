"use server"

import { revalidatePath } from "next/cache"
import { saveReport } from "@/lib/reports"

export type SubmitResult =
  | { ok: true; id: number; reportDate: string; duplicate: boolean; setups: number }
  | { ok: false; error: string }

/** 手動貼上報告（backfill 或測試用） */
export async function submitReport(rawText: string): Promise<SubmitResult> {
  if (!rawText.trim()) {
    return { ok: false, error: "請貼上報告內容" }
  }

  try {
    const { report, duplicate } = await saveReport(rawText, "manual")
    revalidatePath("/")
    return {
      ok: true,
      id: report.id,
      reportDate: report.reportDate,
      duplicate,
      setups: report.parsed.setups.length,
    }
  } catch (error) {
    console.log("[v0] 手動儲存報告失敗:", error)
    return { ok: false, error: error instanceof Error ? error.message : "儲存失敗" }
  }
}
