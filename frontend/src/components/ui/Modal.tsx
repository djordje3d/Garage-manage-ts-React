import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { ButtonIn } from './ButtonIn'
import { useOverlayTransition } from './useOverlayTransition'
import './ui-components.css'

export type ModalProps = {
  modelValue: boolean
  title?: string
  /** Header close button label (Vue Modal uses a plain Cancel; pass i18n from parent). */
  closeLabel?: string
  /** When false, only the title shows in the header (some modals use footer actions only). */
  showHeaderClose?: boolean
  children?: ReactNode
  footer?: ReactNode
  onModelValueChange?: (value: boolean) => void
}

export function Modal({
  modelValue,
  title,
  closeLabel = 'Cancel',
  showHeaderClose = true,
  children,
  footer,
  onModelValueChange,
}: ModalProps) {
  const { mounted, phaseClass, activeClass } = useOverlayTransition(modelValue)

  function close() {
    onModelValueChange?.(false)
  }

  if (!mounted) return null

  return createPortal(
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${activeClass} ${phaseClass}`}
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="modal-dialog dashboard-card max-h-[90vh] w-full max-w-md overflow-auto px-6 pt-6 pb-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title ? (
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              {title}
            </h2>
            {showHeaderClose ? (
              <ButtonIn
                id="modalCloseBtn"
                label={closeLabel}
                variant="outline"
                onUserClick={close}
                caption={closeLabel}
              />
            ) : null}
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? (
          <div className="mt-4 border-t border-gray-200 pt-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
