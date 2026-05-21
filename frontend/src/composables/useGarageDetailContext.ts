import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useDashboardRefreshState } from './DashboardRefreshContext'

/**
 * Route id, abort lifecycle, and dashboard refresh context value for child widgets.
 * Wrap garage detail children with {@link DashboardRefreshProvider} using `dashboardRefresh`.
 */
export function useGarageDetailContext() {
  const { id: routeId } = useParams<{ id: string }>()

  const garageId = useMemo(() => {
    const id = Number(routeId)
    return Number.isFinite(id) && id > 0 ? id : null
  }, [routeId])

  const refresh = useDashboardRefreshState()

  return {
    garageId,
    refreshAbortControllerRef: refresh.refreshAbortControllerRef,
    abortSignal: refresh.abortSignal,
    prepareRefreshCycle: refresh.prepareRefreshCycle,
    dashboardRefresh: {
      abortSignal: refresh.abortSignal,
      prepareRefreshCycle: refresh.prepareRefreshCycle,
    },
  }
}
