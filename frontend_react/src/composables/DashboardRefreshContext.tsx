import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'

export interface DashboardRefreshContextValue {
  /** Current abort signal for in-flight dashboard/garage-detail fetches (null before first refresh cycle). */
  getAbortSignal: () => AbortSignal | null
  /** Abort prior requests and return a fresh signal for the next refresh cycle. */
  prepareRefreshCycle: () => AbortSignal
}

const DashboardRefreshContext = createContext<DashboardRefreshContextValue | null>(
  null,
)

export function useDashboardRefreshState(): DashboardRefreshContextValue & {
  refreshAbortControllerRef: MutableRefObject<AbortController | null>
} {
  const refreshAbortControllerRef = useRef<AbortController | null>(null)

  const getAbortSignal = useCallback(
    (): AbortSignal | null => refreshAbortControllerRef.current?.signal ?? null,
    [],
  )

  const prepareRefreshCycle = useCallback((): AbortSignal => {
    refreshAbortControllerRef.current?.abort()
    const controller = new AbortController()
    refreshAbortControllerRef.current = controller
    return controller.signal
  }, [])

  useEffect(() => {
    return () => {
      refreshAbortControllerRef.current?.abort()
    }
  }, [])

  return { getAbortSignal, prepareRefreshCycle, refreshAbortControllerRef }
}

export function DashboardRefreshProvider({
  value,
  children,
}: {
  value: DashboardRefreshContextValue
  children: ReactNode
}) {
  return (
    <DashboardRefreshContext.Provider value={value}>
      {children}
    </DashboardRefreshContext.Provider>
  )
}

/** Replaces Vue inject("dashboardRefreshAbortSignal"). */
export function useDashboardRefresh(): DashboardRefreshContextValue {
  const ctx = useContext(DashboardRefreshContext)
  if (!ctx) {
    throw new Error('useDashboardRefresh must be used within DashboardRefreshProvider')
  }
  return ctx
}
