import { date, index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import type { ParsedReport } from "../report-types"

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    jobId: text("job_id"),
    reportDate: date("report_date").notNull(),
    title: text("title"),
    /** webhook | manual */
    source: text("source").notNull().default("webhook"),
    rawText: text("raw_text").notNull(),
    parsed: jsonb("parsed").$type<ParsedReport>().notNull(),
    /** 報告內容的 sha256，用來去重（webhook 重送不會產生重複列） */
    contentHash: text("content_hash").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reports_content_hash_idx").on(t.contentHash),
    index("reports_date_idx").on(t.reportDate, t.receivedAt),
  ],
)

export type ReportRow = typeof reports.$inferSelect
