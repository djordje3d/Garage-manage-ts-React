import { createContext, useContext, type ReactNode } from 'react'

export const DASHBOARD_REFRESH_EVENT = 'dashboard-refresh'

export type GetDashboardRefreshAbortSignal = () => AbortSignal | null

export const DashboardRefreshAbortContext =
  createContext<GetDashboardRefreshAbortSignal | null>(null)

/** Reads the current abort signal at call time (matches Vue inject ref timing). */
export function useDashboardRefreshAbortSignal(): GetDashboardRefreshAbortSignal {
  const getSignal = useContext(DashboardRefreshAbortContext)
  if (!getSignal) {
    throw new Error(
      'useDashboardRefreshAbortSignal must be used within DashboardRefreshAbortProvider',
    )
  }
  return getSignal
}

export function DashboardRefreshAbortProvider({
  getSignal,
  children,
}: {
  getSignal: GetDashboardRefreshAbortSignal
  children: ReactNode
}) {
  return (
    <DashboardRefreshAbortContext.Provider value={getSignal}>
      {children}
    </DashboardRefreshAbortContext.Provider>
  )
}
