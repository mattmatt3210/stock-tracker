import { getSnapshot } from "@/lib/stocks"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // 上游 fetch 有 5 分鐘快取，前端輪詢不會打爆 Yahoo
    const snapshot = await getSnapshot(300)
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.log("[v0] /api/stocks failed:", error)
    return Response.json({ error: "無法取得股價資料" }, { status: 502 })
  }
}
