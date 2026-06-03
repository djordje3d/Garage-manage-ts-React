import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type HelpTooltipProps = {
  text: string
  /** When true, renders only a small “?” control; no children. */
  asIcon?: boolean
  /** Accessible name for the icon button. */
  ariaLabel?: string
  children?: ReactNode
}

export function HelpTooltip({
  text,
  asIcon = false,
  ariaLabel = 'Help',
  children,
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const tipId = useId().replace(/:/g, '')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [panelStyle, setPanelStyle] = useState<Record<string, string>>({
    top: '0px',
    left: '0px',
    transform: 'translateX(-50%)',
  })

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openTip = useCallback(() => {
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 100)
  }, [clearCloseTimer])

  const anchorEl = useCallback((): HTMLElement | null => {
    return asIcon ? btnRef.current : rootRef.current
  }, [asIcon])

  const updatePosition = useCallback(() => {
    const el = anchorEl()
    if (!el) return

    const r = el.getBoundingClientRect()
    const margin = 8
    let top = r.bottom + margin
    let left = r.left + r.width / 2

    const tip = tipRef.current
    if (tip) {
      const tr = tip.getBoundingClientRect()
      const half = tr.width / 2
      left = Math.max(
        margin + half,
        Math.min(left, window.innerWidth - margin - half),
      )
      if (top + tr.height > window.innerHeight - margin) {
        top = Math.max(margin, r.top - tr.height - margin)
      }
    }

    setPanelStyle({
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translateX(-50%)',
    })
  }, [anchorEl])

  const scrollOrResizeHandler = useCallback(() => {
    if (open) updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => updatePosition())
      window.addEventListener('scroll', scrollOrResizeHandler, true)
      window.addEventListener('resize', scrollOrResizeHandler)
      return () => {
        cancelAnimationFrame(id)
        window.removeEventListener('scroll', scrollOrResizeHandler, true)
        window.removeEventListener('resize', scrollOrResizeHandler)
      }
    }
    window.removeEventListener('scroll', scrollOrResizeHandler, true)
    window.removeEventListener('resize', scrollOrResizeHandler)
  }, [open, scrollOrResizeHandler, updatePosition])

  useEffect(() => {
    return () => {
      clearCloseTimer()
      window.removeEventListener('scroll', scrollOrResizeHandler, true)
      window.removeEventListener('resize', scrollOrResizeHandler)
    }
  }, [clearCloseTimer, scrollOrResizeHandler])

  function onWrapFocusIn() {
    clearCloseTimer()
    setOpen(true)
  }

  function onWrapFocusOut(ev: FocusEvent<HTMLDivElement>) {
    const next = ev.relatedTarget as Node | null
    if (next && rootRef.current?.contains(next)) return
    setOpen(false)
  }

  const tooltipPortal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={tipId}
            ref={tipRef}
            role="tooltip"
            className="help-tooltip__panel pointer-events-none fixed z-[10050] max-w-xs rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white shadow-lg"
            style={panelStyle}
          >
            {text}
          </div>,
          document.body,
        )
      : null

  if (asIcon) {
    return (
      <>
        <button
          ref={btnRef}
          type="button"
          className="help-tooltip__icon-btn flex h-4 w-4 m-0 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-bold leading-none text-gray-500 hover:border-gray-400 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
          aria-label={ariaLabel}
          aria-describedby={open ? tipId : undefined}
          onMouseEnter={openTip}
          onMouseLeave={scheduleClose}
          onFocus={openTip}
          onBlur={scheduleClose}
        >
          <span aria-hidden="true">?</span>
        </button>
        {tooltipPortal}
      </>
    )
  }

  return (
    <>
      <div
        ref={rootRef}
        className="help-tooltip__wrap inline-flex"
        onMouseEnter={openTip}
        onMouseLeave={scheduleClose}
        onFocusCapture={onWrapFocusIn}
        onBlurCapture={onWrapFocusOut}
      >
        {children}
      </div>
      {tooltipPortal}
    </>
  )
}
