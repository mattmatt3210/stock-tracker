import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-end justify-between gap-4 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Hermes Agent · Momentum Scan
            </span>
            <h1 className="text-balance text-2xl font-semibold leading-none">每日動能掃描看板</h1>
            <p className="text-xs text-muted-foreground">
              美股收市後排程報告 · 疊上 Yahoo 即時價追蹤樞紐距離
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-6 md:px-6">
        <Dashboard />
      </main>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto w-full max-w-[100rem] px-4 py-4 text-[11px] leading-relaxed text-muted-foreground md:px-6">
          報告內容由 Hermes Agent 產生，即時報價由 Yahoo Finance 提供。本頁僅呈現資料，不會代為下單，
          亦不構成投資建議。
        </div>
      </footer>
    </div>
  )
}
