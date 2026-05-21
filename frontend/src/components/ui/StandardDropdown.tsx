import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import './ui-components.css'

export type DropdownOption = { id: number | string; label: string }

export type StandardDropdownProps = {
  label?: string
  labelClass?: string
  options: DropdownOption[]
  modelValue: number | string | null
  placeholder?: string
  nullable?: boolean
  nullOptionLabel?: string
  /** When true, use dark background (e.g. for header) matching slate-800 */
  dark?: boolean
  onModelValueChange?: (value: number | string | null) => void
  onChange?: (value: number | string | null) => void
}

const MENU_GAP = 8
const VIEW_MARGIN = 10
const LIST_MAX_H = 256
const ROW_EST = 40

function usePopTransition(visible: boolean, leaveMs = 160) {
  const [mounted, setMounted] = useState(visible)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = window.setTimeout(() => setMounted(false), leaveMs)
    return () => window.clearTimeout(t)
  }, [visible, leaveMs])

  const popClass = cn(
    mounted && (shown ? 'pop-enter-to pop-leave-from' : 'pop-enter-from pop-leave-to'),
    mounted && 'pop-enter-active pop-leave-active',
  )

  return { mounted, popClass }
}

export function StandardDropdown({
  label,
  labelClass = 'text-sm font-medium',
  options,
  modelValue,
  placeholder = 'Select…',
  nullable = false,
  nullOptionLabel = '',
  dark = false,
  onModelValueChange,
  onChange,
}: StandardDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [nubStyle, setNubStyle] = useState<CSSProperties>({})
  const [focusedIndex, setFocusedIndex] = useState(0)

  const { mounted: menuMounted, popClass } = usePopTransition(open)

  const selectedLabel = useMemo(() => {
    if (modelValue == null) {
      return nullable ? nullOptionLabel : placeholder
    }
    return (
      options.find((o) => o.id === modelValue)?.label ?? placeholder
    )
  }, [modelValue, nullable, nullOptionLabel, placeholder, options])

  const nubBorderAdjustClass = openUp
    ? 'border-b-0 border-r-0 -mb-[1px]'
    : 'border-t-0 border-l-0 -mt-[1px]'

  const close = useCallback(() => setOpen(false), [])

  const choose = useCallback(
    (id: number | string | null) => {
      onModelValueChange?.(id)
      onChange?.(id)
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    },
    [onChange, onModelValueChange],
  )

  const getAllItemButtons = useCallback(
    () => itemRefs.current.filter(Boolean) as HTMLButtonElement[],
    [],
  )

  const focusItem = useCallback(
    (index: number) => {
      const els = getAllItemButtons()
      if (!els.length) return
      const clamped = Math.max(0, Math.min(index, els.length - 1))
      setFocusedIndex(clamped)
      els[clamped]?.focus()
    },
    [getAllItemButtons],
  )

  const focusNext = useCallback(() => {
    focusItem(focusedIndex + 1)
  }, [focusItem, focusedIndex])

  const focusPrev = useCallback(() => {
    focusItem(focusedIndex - 1)
  }, [focusItem, focusedIndex])

  const selectFocused = useCallback(() => {
    const els = getAllItemButtons()
    els[focusedIndex]?.click()
  }, [focusedIndex, getAllItemButtons])

  const getSelectedIndex = useCallback(() => {
    if (modelValue == null) return nullable ? 0 : -1
    const idx = options.findIndex((o) => o.id === modelValue)
    return idx >= 0 ? (nullable ? 1 + idx : idx) : -1
  }, [modelValue, nullable, options])

  const estimateMenuHeight = useCallback(() => {
    const rows = (nullable ? 1 : 0) + options.length
    return Math.min(LIST_MAX_H + 36, Math.max(48, rows * ROW_EST + 32))
  }, [nullable, options.length])

  const readMenuHeight = useCallback(() => {
    const m = menuRef.current
    if (!m) return estimateMenuHeight()
    const h = m.getBoundingClientRect().height
    if (h > 1) return h
    return estimateMenuHeight()
  }, [estimateMenuHeight])

  const positionMenu = useCallback(() => {
    const t = triggerRef.current
    if (!t) return

    const rect = t.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    const menuH = readMenuHeight()
    const needH = menuH + MENU_GAP

    const spaceBelow = viewportH - rect.bottom - VIEW_MARGIN
    const spaceAbove = rect.top - VIEW_MARGIN

    const opensUp = spaceBelow < needH && spaceAbove > spaceBelow
    setOpenUp(opensUp)

    const width = rect.width
    const left = Math.min(
      Math.max(rect.left, VIEW_MARGIN),
      viewportW - width - VIEW_MARGIN,
    )

    let top: number
    if (opensUp) {
      top = rect.top - MENU_GAP - menuH
      top = Math.max(VIEW_MARGIN, top)
    } else {
      top = rect.bottom + MENU_GAP
      if (top + menuH > viewportH - VIEW_MARGIN) {
        top = Math.max(
          VIEW_MARGIN,
          Math.min(top, viewportH - VIEW_MARGIN - menuH),
        )
      }
    }

    setMenuStyle({
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
    })

    setNubStyle(opensUp ? { bottom: '-6px' } : { top: '-6px' })
  }, [readMenuHeight])

  const openMenu = useCallback(
    (after?: () => void) => {
      setOpen(true)
      requestAnimationFrame(() => {
        positionMenu()
        const selectedIdx = getSelectedIndex()
        focusItem(selectedIdx >= 0 ? selectedIdx : 0)
        after?.()
        requestAnimationFrame(() => positionMenu())
      })
    },
    [focusItem, getSelectedIndex, positionMenu],
  )

  const toggle = useCallback(() => {
    if (open) close()
    else openMenu()
  }, [close, open, openMenu])

  const openAndFocusFirst = useCallback(() => {
    if (!open) openMenu(() => focusItem(0))
    else focusItem(0)
  }, [focusItem, open, openMenu])

  const openAndFocusLast = useCallback(() => {
    const count = getAllItemButtons().length
    if (!open) openMenu(() => focusItem(count - 1))
    else focusItem(count - 1)
  }, [focusItem, getAllItemButtons, open, openMenu])

  const onClickOutside = useCallback(
    (e: globalThis.MouseEvent) => {
      if (!open) return
      const trg = triggerRef.current
      const mn = menuRef.current
      const target = e.target as Node

      if (trg?.contains(target)) return
      if (mn?.contains(target)) return
      close()
    },
    [close, open],
  )

  const onResizeOrScroll = useCallback(() => {
    if (!open) return
    positionMenu()
  }, [open, positionMenu])

  useEffect(() => {
    const onDocMouseDown = (e: Event) =>
      onClickOutside(e as globalThis.MouseEvent)
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('resize', onResizeOrScroll)
    window.addEventListener('scroll', onResizeOrScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('resize', onResizeOrScroll)
      window.removeEventListener('scroll', onResizeOrScroll, true)
    }
  }, [onClickOutside, onResizeOrScroll])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(positionMenu)
    }
  }, [open, options, positionMenu])

  const setItemRef = (index: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[index] = el
  }

  const itemButtonClass = (selected: boolean) =>
    cn(
      'w-full px-3 py-2 text-left focus:outline-none',
      dark
        ? 'hover:bg-slate-700 focus:bg-slate-700'
        : 'hover:bg-emerald-50 focus:bg-emerald-50',
      {
        'font-semibold text-emerald-700': !dark && selected,
        'font-semibold text-emerald-300': dark && selected,
      },
    )

  const menuPortal =
    menuMounted && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={cn('fixed zPopup', popClass)}
            style={menuStyle}
          >
            <div
              className={cn(
                'rounded-lg border shadow-xl overflow-hidden',
                dark
                  ? 'border-slate-600 bg-slate-800 ring-1 ring-black/20'
                  : 'border-gray-200 bg-white ring-1 ring-black/5',
              )}
            >
              <div
                className="pointer-events-none absolute left-6"
                style={nubStyle}
              >
                <div
                  className={cn(
                    'h-3 w-3 rotate-45 shadow-sm',
                    nubBorderAdjustClass,
                    dark
                      ? 'bg-slate-800 border-slate-600'
                      : 'bg-white border border-gray-200',
                  )}
                />
              </div>

              <ul
                className={cn(
                  'max-h-64 overflow-auto py-1 text-sm',
                  dark ? 'text-white' : '',
                )}
                role="listbox"
                tabIndex={-1}
                onKeyDown={(e: KeyboardEvent<HTMLUListElement>) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    close()
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    focusNext()
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    focusPrev()
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    selectFocused()
                  }
                }}
              >
                {nullable ? (
                  <li>
                    <button
                      ref={setItemRef(0)}
                      type="button"
                      className={itemButtonClass(modelValue === null)}
                      onClick={() => choose(null)}
                    >
                      {nullOptionLabel}
                    </button>
                  </li>
                ) : null}
                {options.map((opt, i) => {
                  const refIndex = (nullable ? 1 : 0) + i
                  return (
                    <li key={String(opt.id)}>
                      <button
                        ref={setItemRef(refIndex)}
                        type="button"
                        className={itemButtonClass(modelValue === opt.id)}
                        onClick={() => choose(opt.id)}
                      >
                        {opt.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="standard-dropdown relative inline-block w-full">
      {label ? (
        <label className={cn('mb-1 block text-gray-600', labelClass)}>
          {label}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'h-12 w-full rounded border px-3 text-left text-sm font-medium shadow-sm transition',
          label ? 'mt-1' : undefined,
          dark
            ? 'border-slate-600 bg-slate-800 text-white hover:bg-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500'
            : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400',
        )}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            openAndFocusFirst()
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            openAndFocusLast()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{selectedLabel}</span>
          <span className={dark ? 'text-slate-300' : 'text-gray-500'}>
            <svg
              className={cn(
                'h-4 w-4 transition-transform',
                open ? 'rotate-180' : undefined,
              )}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </span>
      </button>

      {menuPortal}
    </div>
  )
}
