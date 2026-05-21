import { useEffect, useRef, useState } from 'react'

const DEFAULT_POLL_MS = 10_000
const TICK_MS = 250

export function useDashboardPolling(
  refresh: () => void,
  options?: { intervalMs?: number; enabled?: boolean },
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_MS
  const enabled = options?.enabled ?? true

  const pollIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [remainingMs, setRemainingMs] = useState(intervalMs)
  const [isRunning, setIsRunning] = useState(false)

  const stopCountdown = (resetToFull = false) => {
    if (tickIdRef.current) {
      clearInterval(tickIdRef.current)
      tickIdRef.current = null
    }
    setIsRunning(false)
    if (resetToFull) setRemainingMs(intervalMs)
  }

  const startCountdown = () => {
    stopCountdown()
    setRemainingMs(intervalMs)
    setIsRunning(true)
    tickIdRef.current = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - TICK_MS))
    }, TICK_MS)
  }

  const stopPolling = (resetCountdownToFull = false) => {
    if (pollIdRef.current) {
      clearInterval(pollIdRef.current)
      pollIdRef.current = null
    }
    stopCountdown(resetCountdownToFull)
  }

  const doRefreshAndRestartCountdown = () => {
    refresh()
    if (document.visibilityState === 'visible' && enabled) {
      startCountdown()
    }
  }

  const startPolling = () => {
    if (pollIdRef.current) return
    if (!enabled) return
    if (document.visibilityState !== 'visible') return
    startCountdown()
    pollIdRef.current = setInterval(doRefreshAndRestartCountdown, intervalMs)
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        stopPolling()
        if (enabled) {
          doRefreshAndRestartCountdown()
          startPolling()
        }
      } else {
        stopPolling()
      }
    }

    if (document.visibilityState === 'visible' && enabled) {
      startPolling()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs])

  return { startPolling, stopPolling, remainingMs, intervalMs, isRunning }
}
