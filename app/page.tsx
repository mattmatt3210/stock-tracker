import { Dashboard } from "@/components/dashboard"
import { getSnapshot } from "@/lib/stocks"

export const dynamic = "force-dynamic"

export default async function Page() {
  const snapshot = await getSnapshot(300)
  return <Dashboard initialSnapshot={snapshot} />
}
