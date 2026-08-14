/**
 * 與 vercel.json 內的 crons 對應。時間一律為 UTC。
 * 若你改了 vercel.json，請同步改這裡，狀態面板才會顯示正確的下次執行時間。
 */
export const CRON_RUNS = [
  { label: "港股收盤後", utcHour: 9, utcMinute: 5 },
  { label: "美股收盤後", utcHour: 21, utcMinute: 15 },
]

export function nextRunAt(from: Date = new Date()): { at: Date; label: string } {
  const candidates = CRON_RUNS.flatMap((run) =>
    [0, 1].map((dayOffset) => {
      const at = new Date(
        Date.UTC(
          from.getUTCFullYear(),
          from.getUTCMonth(),
          from.getUTCDate() + dayOffset,
          run.utcHour,
          run.utcMinute,
          0,
          0,
        ),
      )
      return { at, label: run.label }
    }),
  )

  return candidates
    .filter((candidate) => candidate.at.getTime() > from.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
}
