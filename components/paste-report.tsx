"use client"

import { useState, useTransition } from "react"
import { ClipboardPaste, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { submitReport } from "@/app/actions/reports"

export function PasteReport({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    setMessage(null)
    startTransition(async () => {
      const result = await submitReport(text)
      if (result.ok) {
        setMessage({
          ok: true,
          text: result.duplicate
            ? "這份報告已經存在，已顯示既有紀錄"
            : `已儲存：解析出 ${result.setups} 個 setup、${result.positions} 個持倉`,
        })
        setText("")
        onSaved()
      } else {
        setMessage({ ok: false, text: result.error })
      }
    })
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <ClipboardPaste className="size-3.5" aria-hidden />
        貼上報告
      </Button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">貼上 Hermes 報告</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          className="size-7"
          aria-label="關閉"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>

      <label htmlFor="report-text" className="sr-only">
        報告內容
      </label>
      <textarea
        id="report-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="把 Hermes Agent 的完整報告文字貼進來…"
        className="w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {message && (
        <p
          role="status"
          className={`text-xs leading-relaxed ${message.ok ? "text-trigger" : "text-down"}`}
        >
          {message.text}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={pending || !text}>
          清空
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={pending || !text.trim()}>
          {pending ? "解析中…" : "解析並儲存"}
        </Button>
      </div>
    </div>
  )
}
