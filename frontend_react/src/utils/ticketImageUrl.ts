const fileserverBase =
  import.meta.env.VITE_FILESERVER_URL || 'http://localhost:9009'

/**
 * Resolve ticket image_url for <img src>. Absolute URLs pass through;
 * relative paths (e.g. /ticket_xxx.jpg) use the static fileserver on port 9009.
 */
export function normalizeTicketImageUrl(
  url?: string | null,
): string | undefined {
  if (!url?.trim()) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  const path = url.startsWith('/') ? url : `/${url}`
  return `${fileserverBase.replace(/\/+$/, '')}${path}`
}
