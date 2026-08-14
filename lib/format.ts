export function formatPrice(value: number): string {
  return value.toLocaleString("zh-Hant", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${Math.abs(value).toLocaleString("zh-Hant", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatPercent(value: number): string {
  return `${formatSigned(value)}%`
}

export function formatVolume(value: number | null): string {
  if (value === null) return "—"
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 億`
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)} 萬`
  return value.toLocaleString("zh-Hant")
}

export function currencySymbol(currency: string): string {
  if (currency === "USD") return "US$"
  if (currency === "HKD") return "HK$"
  return `${currency} `
}

const TAIPEI = "Asia/Taipei"

export function formatDateTime(iso: string | number | Date): string {
  const date = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso)
  return new Intl.DateTimeFormat("zh-Hant", {
    timeZone: TAIPEI,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

export function formatClock(iso: string | Date): string {
  return new Intl.DateTimeFormat("zh-Hant", {
    timeZone: TAIPEI,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "剛剛"
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

export function formatCountdown(target: Date, from: Date = new Date()): string {
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - from.getTime()) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/** 圖表 X 軸用的日期標籤 */
export function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-")
  return `${Number(month)}/${Number(day)}`
}
