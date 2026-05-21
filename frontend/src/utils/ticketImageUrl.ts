import { baseURL } from '../api/client'

export function normalizeTicketImageUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  const path = url.startsWith('/') ? url : `/${url}`
  try {
    const api = new URL(
      baseURL,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000',
    )
    return `${api.origin}${path}`
  } catch {
    const base = baseURL.replace(/\/+$/, '')
    return base ? `${base}${path}` : path
  }
}
