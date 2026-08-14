import { headers } from "next/headers"
import { getSnapshot } from "@/lib/stocks"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * 每日排程：強制重新抓取一次最新收盤資料，順便把 Next.js 的 fetch 快取推新。
 * Vercel Cron 會帶 Authorization: Bearer $CRON_SECRET（若有設定該環境變數）。
 */
export async function GET() {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authorization = (await headers()).get("authorization")
    if (authorization !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const startedAt = Date.now()
  const snapshot = await getSnapshot(false)
  const durationMs = Date.now() - startedAt

  return Response.json({
    ok: snapshot.failures.length === 0,
    ranAt: snapshot.fetchedAt,
    durationMs,
    fetched: snapshot.quotes.length,
    failures: snapshot.failures,
  })
}
