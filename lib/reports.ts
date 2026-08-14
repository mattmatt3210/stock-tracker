import { createHash } from "node:crypto"
import { desc, eq } from "drizzle-orm"
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

export async function saveReport(
  rawText: string,
  source: "webhook" | "manual",
): Promise<{ report: StoredReport; duplicate: boolean }> {
  const text = rawText.trim()
  if (!text) throw new Error("報告內容為空")

  const parsed = parseReport(text)

  // 擋掉不像報告的內容，否則會存成空報告並蓋掉真正的最新一份
  const valid = validateReport(parsed, text)
  if (!valid.ok) throw new ReportValidationError(valid.reason)

  const contentHash = createHash("sha256").update(text).digest("hex")
  // validateReport 已確保 reportDate 存在
  const reportDate = parsed.reportDate as string

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
    })
    .onConflictDoNothing({ target: reports.contentHash })
    .returning()

  if (inserted.length > 0) {
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
