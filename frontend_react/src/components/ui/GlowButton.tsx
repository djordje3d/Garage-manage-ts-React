import {
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import './ui-components.css'

export type GlowButtonProps = {
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  className?: string
  children?: ReactNode
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'disabled' | 'className' | 'children'
>

export function GlowButton({
  type = 'button',
  disabled = false,
  loading = false,
  className,
  children,
  onMouseMove,
  onMouseLeave,
  ...rest
}: GlowButtonProps) {
  const [hoverGlow, setHoverGlow] = useState<Record<string, string> | null>(
    null,
  )

  const inactive = disabled || loading

  function onMove(e: MouseEvent<HTMLButtonElement>) {
    if (inactive) return
    onMouseMove?.(e)

    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setHoverGlow({
      background: `radial-gradient(circle at ${x}px ${y}px,
        rgba(255,255,255,0.35),
        transparent 60%)`,
    })
  }

  function onLeave(e: MouseEvent<HTMLButtonElement>) {
    onMouseLeave?.(e)
    setHoverGlow(null)
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={inactive}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        'glow-btn relative overflow-hidden rounded bg-emerald-600 py-2 font-medium text-white transition-colors duration-200 hover:bg-emerald-700 disabled:opacity-50',
        className,
      )}
    >
      {!hoverGlow && !inactive ? (
        <span className="pointer-events-none absolute inset-0 shimmer-layer" />
      ) : null}

      <span
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-150',
          hoverGlow && !inactive ? 'opacity-100' : 'opacity-0',
        )}
        style={hoverGlow ?? undefined}
      />

      <span className="relative z-10">{children}</span>
    </button>
  )
}
