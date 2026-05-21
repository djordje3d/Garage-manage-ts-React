export function formatTime(
  s: string | null | undefined,
  locale: 'en' | 'sr' = 'en',
): string {
  if (s == null || s === '') return '–'
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    const resolvedLocale = locale === 'sr' ? 'sr-RS' : 'en-US'
    return new Intl.DateTimeFormat(resolvedLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return String(s)
  }
}

export function formatNumber(value: string | number | null | undefined): string {
  if (value == null || value === '') return '–'
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(n)) return '–'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

export function formatMoney(value: string | number | null | undefined): string {
  const formatted = formatNumber(value)
  if (formatted === '–') return '–'
  return formatted + ' RSD'
}

export function formatRate(value: string | number | null | undefined): string {
  return formatNumber(value)
}
