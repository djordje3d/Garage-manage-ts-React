import { createContext, useContext, type ReactNode } from 'react'

export const DASHBOARD_REFRESH_EVENT = 'dashboard-refresh'

export const DashboardRefreshAbortContext = createContext<AbortSignal | null>(
  null,
)

export function useDashboardRefreshAbortSignal(): AbortSignal | null {
  return useContext(DashboardRefreshAbortContext)
}

export function DashboardRefreshAbortProvider({
  signal,
  children,
}: {
  signal: AbortSignal | null
  children: ReactNode
}) {
  return (
    <DashboardRefreshAbortContext.Provider value={signal}>
      {children}
    </DashboardRefreshAbortContext.Provider>
  )
}
