import { createHash } from "node:crypto"
import { and, desc, eq, lt, notInArray } from "drizzle-orm"
import { db } from "./db"
import { reports, type ReportRow } from "./db/schema"
import { parseReport, validateReport } from "./report-parser"
import type { ParsedReport } from "./report-types"

/** 內容不像報告（相對於資料庫等系統錯誤），對應 HTTP 422 */
export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReportValidationError"
  }
}

export interface StoredReport {
  id: number
  jobId: string | null
  reportDate: string
  title: string | null
  source: string
  receivedAt: string
  parsed: ParsedReport
  rawText: string
  /** pending | llm | regex */
  parseMethod: string
  parseError: string | null
}

function toStored(row: ReportRow): StoredReport {
  return {
    id: row.id,
    jobId: row.jobId,
    reportDate: row.reportDate,
    title: row.title,
    source: row.source,
    receivedAt:
      row.receivedAt instanceof Date ? row.receivedAt.toISOString() : String(row.receivedAt),
    parsed: row.parsed,
    rawText: row.rawText,
    parseMethod: row.parseMethod,
    parseError: row.parseError,
  }
}

/** 報告摘要，用於歷史列表（不含 rawText 以減少傳輸量） */
export interface ReportSummary {
  id: number
  reportDate: string
  receivedAt: string
  source: string
  setupCount: number
  positionCount: number
  verdict: string | null
}

/** 報告保留天數，超過的舊報告會在新報告入庫時刪除 */
export const RETENTION_DAYS = 30

/**
 * 刪除超過保留期限的報告（以報告日期計）。
 * 永遠保留 keepId（剛入庫那筆）與資料庫裡最新的一筆，
 * 這樣即使 Hermes 停推很久，看板也不會被清空。
 */
export async function pruneOldReports(keepId: number): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const latest = await getLatestReport()
  const protectedIds = [keepId, ...(latest ? [latest.id] : [])]

  const deleted = await db
    .delete(reports)
    .where(and(lt(reports.reportDate, cutoff), notInArray(reports.id, protectedIds)))
    .returning({ id: reports.id })

  if (deleted.length > 0) {
    console.log(`[v0] 已清理 ${deleted.length} 份超過 ${RETENTION_DAYS} 天的舊報告`)
  }
  return deleted.length
}

export async function saveReport(
  rawText: string,
  source: "webhook" | "manual",
): Promise<{ report: StoredReport; duplicate: boolean }> {
  const text = rawText.trim()
  if (!text) throw new Error("報告內容為空")

  // 擋掉不像報告的內容，否則會存成空報告並蓋掉真正的最新一份。
  // 只看原文特徵，不看解析結果（regex 對真實報告常抓不到東西）
  const valid = validateReport(text)
  if (!valid.ok) throw new ReportValidationError(valid.reason)

  // 先用 regex 快速解析並立即入庫，讓 webhook 能馬上回應；
  // LLM 抽取較慢（約 30 秒），改由背景任務補上（refineReport）
  const parsed = parseReport(text)
  const contentHash = createHash("sha256").update(text).digest("hex")
  const reportDate = parsed.reportDate ?? new Date().toISOString().slice(0, 10)

  const inserted = await db
    .insert(reports)
    .values({
      jobId: parsed.jobId,
      reportDate,
      title: parsed.title,
      source,
      rawText: text,
      parsed,
      contentHash,
      parseMethod: "pending",
    })
    .onConflictDoNothing({ target: reports.contentHash })
    .returning()

  if (inserted.length > 0) {
    // 清理失敗不該讓入庫失敗：報告已存好，舊資料下次寫入時再清
    await pruneOldReports(inserted[0].id).catch((error) => {
      console.log("[v0] 清理舊報告失敗:", error)
    })
    return { report: toStored(inserted[0]), duplicate: false }
  }

  // 內容雜湊撞到 = 同一份報告已存在，回傳既有那筆
  const existing = await db
    .select()
    .from(reports)
    .where(eq(reports.contentHash, contentHash))
    .limit(1)

  return { report: toStored(existing[0]), duplicate: true }
}

/**
 * 用 LLM 重新抽取指定報告並覆寫 parsed。
 *
 * 設計成獨立於 saveReport：LLM 約需 30 秒，若同步等待會讓 webhook 逾時，
 * 所以入庫先用 regex 佔位，這裡在背景把資料升級成 LLM 版本。
 * 失敗時保留 regex 結果並記錄原因，不讓整份報告消失。
 */
export async function refineReport(id: number): Promise<ParsedReport | null> {
  const row = await getReportById(id)
  if (!row) return null

  const { extractReport } = await import("./report-llm")
  const { parsed, method, error } = await extractReport(row.rawText)

  await db
    .update(reports)
    .set({
      parsed,
      parseMethod: method,
      parseError: error ?? null,
      // LLM 通常能抓到 regex 抓不到的日期與標題
      reportDate: parsed.reportDate ?? row.reportDate,
      title: parsed.title ?? row.title,
      jobId: parsed.jobId ?? row.jobId,
    })
    .where(eq(reports.id, id))

  return parsed
}

export async function getLatestReport(): Promise<StoredReport | null> {
  const rows = await db
    .select()
    .from(reports)
    .orderBy(desc(reports.reportDate), desc(reports.receivedAt))
    .limit(1)
  return rows.length > 0 ? toStored(rows[0]) : null
}

export async function getReportById(id: number): Promise<StoredReport | null> {
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1)
  return rows.length > 0 ? toStored(rows[0]) : null
}

export async function listReports(limit = 60): Promise<ReportSummary[]> {
  const rows = await db
    .select({
      id: reports.id,
      reportDate: reports.reportDate,
      receivedAt: reports.receivedAt,
      source: reports.source,
      parsed: reports.parsed,
    })
    .from(reports)
    .orderBy(desc(reports.reportDate), desc(reports.receivedAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    reportDate: r.reportDate,
    receivedAt: r.receivedAt instanceof Date ? r.receivedAt.toISOString() : String(r.receivedAt),
    source: r.source,
    setupCount: r.parsed?.setups?.length ?? 0,
    positionCount: r.parsed?.positions?.length ?? 0,
    verdict: r.parsed?.market?.verdict ?? null,
  }))
}
