import { useCallback, useRef, useState } from 'react'

const DEFAULT_DURATION_MS = 4000

export function useToast() {
  const [message, setMessage] = useState('')
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, durationMs = DEFAULT_DURATION_MS) => {
    const normalized = msg.trim()
    if (timeoutIdRef.current != null) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
    if (!normalized) {
      setMessage('')
      return
    }
    setMessage(normalized)
    timeoutIdRef.current = setTimeout(() => {
      setMessage('')
      timeoutIdRef.current = null
    }, durationMs)
  }, [])

  const clearToast = useCallback(() => {
    if (timeoutIdRef.current != null) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
    setMessage('')
  }, [])

  return { message, showToast, clearToast }
}

export type ToastApi = ReturnType<typeof useToast>
