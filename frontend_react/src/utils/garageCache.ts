import type { Garage } from '../api/garages'

const STORAGE_KEY = 'dashboard-garages-v1'
const TTL_MS = 5 * 60 * 1000

interface CachedPayload {
  savedAt: number
  items: Garage[]
}

export function readGaragesCache(): { items: Garage[]; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPayload
    if (!parsed?.items || !Array.isArray(parsed.items)) return null
    const age = Date.now() - (parsed.savedAt ?? 0)
    return { items: parsed.items, fresh: age >= 0 && age < TTL_MS }
  } catch {
    return null
  }
}

export function writeGaragesCache(items: Garage[]): void {
  try {
    const payload: CachedPayload = { savedAt: Date.now(), items }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function clearGaragesCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
