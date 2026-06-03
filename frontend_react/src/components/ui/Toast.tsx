import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ToastApi } from '@/composables/useToast'
import './ui-components.css'

export const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({
  value,
  children,
}: {
  value: ToastApi
  children: ReactNode
}) {
  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  )
}

export type ToastProps = {
  /** Optional override; defaults to ToastContext (Vue inject equivalent). */
  toast?: ToastApi | null
}

export function Toast({ toast: toastProp }: ToastProps) {
  const fromContext = useContext(ToastContext)
  const toast = toastProp ?? fromContext
  const message = toast?.message?.trim()

  if (!message || typeof document === 'undefined') return null

  return createPortal(
    <div className="toast-snackbar" role="status" aria-live="polite">
      {message}
    </div>,
    document.body,
  )
}
