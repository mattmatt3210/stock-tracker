import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// 開發模式下 HMR 會重複執行模組，快取 Pool 避免連線數爆掉
const globalForDb = globalThis as unknown as { __pool?: Pool }

export const pool =
  globalForDb.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool

export const db = drizzle(pool, { schema })
