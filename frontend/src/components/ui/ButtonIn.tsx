import {
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import './ui-components.css'

export type ButtonInVariant =
  | 'primary'
  | 'danger'
  | 'outline'
  | 'default'
  | 'link'

export type ButtonInProps = {
  id: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  variant?: ButtonInVariant
  icon?: string
  label?: string
  caption?: string
  children?: ReactNode
  onUserClick?: (e?: MouseEvent<HTMLButtonElement>) => void
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'id' | 'type' | 'disabled' | 'children' | 'onClick' | 'title'
>

function variantClasses(variant: ButtonInVariant): string {
  switch (variant) {
    case 'danger':
      return 'min-w-[7.5rem] bg-red-600 text-white hover:bg-red-700'
    case 'outline':
      return 'border border-emerald-600 text-emerald-600 bg-transparent hover:bg-emerald-50'
    case 'link':
      return 'bg-transparent px-0 py-0 rounded-none text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1'
    default:
      return 'min-w-[7.5rem] bg-emerald-600 text-white hover:bg-emerald-700'
  }
}

export function ButtonIn({
  id,
  type = 'button',
  disabled = false,
  variant = 'primary',
  icon,
  label,
  caption,
  children,
  className,
  onUserClick,
  onMouseMove,
  onMouseLeave,
  ...rest
}: ButtonInProps) {
  const [hoverGlow, setHoverGlow] = useState<Record<string, string> | null>(
    null,
  )

  const hasSlotContent =
    children != null &&
    (typeof children !== 'string' || children.trim() !== '')

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    if (disabled) return
    onUserClick?.(e)
  }

  function onMove(e: MouseEvent<HTMLButtonElement>) {
    if (disabled) return
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
      id={id}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        'btn-in group relative overflow-hidden rounded-lg px-4 py-2 font-medium transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses(variant),
        className,
      )}
      title={caption}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-150',
          hoverGlow && !disabled ? 'opacity-100' : 'opacity-0',
        )}
        style={hoverGlow ?? undefined}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {hasSlotContent ? children : label ? label : null}
      </span>
      {typeof icon !== 'undefined' ? <span className={icon} /> : null}
    </button>
  )
}
