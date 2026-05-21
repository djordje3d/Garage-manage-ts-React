import { useEffect, useState } from 'react'

/** Mount/unmount with enter/leave CSS classes (Vue Transition equivalent). */
export function useOverlayTransition(visible: boolean, leaveMs = 350) {
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

  const phaseClass = mounted && !shown ? 'modal-fade-enter-from modal-fade-leave-to' : ''
  const activeClass = mounted ? 'modal-fade-enter-active modal-fade-leave-active' : ''

  return { mounted, shown, phaseClass, activeClass }
}
