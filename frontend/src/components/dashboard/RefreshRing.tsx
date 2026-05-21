import { useEffect, useMemo, useRef } from 'react'
import './dashboard-components.css'

export type RefreshRingProps = {
  durationMs: number
  remainingMs: number
  enabled?: boolean
  autoRefreshEnabled: boolean
  onToggleAutoRefresh?: () => void
}

export function RefreshRing({
  durationMs,
  remainingMs,
  autoRefreshEnabled,
  onToggleAutoRefresh,
}: RefreshRingProps) {
  const circlePathRef = useRef<SVGCircleElement | null>(null)
  const lengthRef = useRef(0)

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil(remainingMs / 1000)),
    [remainingMs],
  )

  function updateRing() {
    const circle = circlePathRef.current
    if (!circle || !durationMs) return
    const ratio = Math.max(0, Math.min(1, remainingMs / durationMs))
    const offset = lengthRef.current * (1 - ratio)
    circle.style.strokeDashoffset = String(offset)
  }

  useEffect(() => {
    const circle = circlePathRef.current
    if (!circle) return
    lengthRef.current = circle.getTotalLength()
    circle.style.strokeDasharray = String(lengthRef.current)
    circle.style.strokeDashoffset = '0'
    updateRing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    updateRing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, autoRefreshEnabled, durationMs])

  return (
    <div
      className={`countdown countdown--refresh-ring ${!autoRefreshEnabled ? 'countdown--paused' : ''}`}
      role="button"
      tabIndex={0}
      title={autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
      onClick={onToggleAutoRefresh}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleAutoRefresh?.()
        }
      }}
    >
      <svg className="countdown__icon" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="countdown__icon__track" cx="50" cy="50" r="42" />
        <circle
          ref={circlePathRef}
          className="countdown__icon__circle"
          cx="50"
          cy="50"
          r="42"
        />
      </svg>
      <span className="countdown__number">{secondsLeft}</span>
    </div>
  )
}
