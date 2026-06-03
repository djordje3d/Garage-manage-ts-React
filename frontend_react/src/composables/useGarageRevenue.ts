import { useCallback, useState } from 'react'
import { getDashboardAnalytics } from '../api/dashboard'
import type { DashboardAnalytics } from '../api/dashboard'
import { getTodayISO, getMonthStartEnd } from '../utils/dashboardDates'

function isCanceled(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ERR_CANCELED'
}

export function useGarageRevenue(garageId: number | null) {
  const [revenueDash, setRevenueDash] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const fetchRevenue = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const id = garageId
      if (!id) {
        setRevenueDash(null)
        setLoading(false)
        setRefreshing(false)
        return
      }

      const hadData = hasLoadedOnce
      if (!hadData) {
        setLoading(true)
        setError(false)
      } else {
        setRefreshing(true)
      }

      const today = getTodayISO()
      const { from: monthFrom, to: monthTo } = getMonthStartEnd()

      try {
        const res = await getDashboardAnalytics(
          {
            garage_id: id,
            today,
            month_from: monthFrom,
            month_to: monthTo,
          },
          { signal },
        )
        setRevenueDash(res.data)
        setError(false)
        setHasLoadedOnce(true)
      } catch (err: unknown) {
        if (isCanceled(err)) return
        setError(true)
        if (!hadData) setRevenueDash(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [garageId, hasLoadedOnce],
  )

  return {
    revenueDash,
    setRevenueDash,
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    error,
    setError,
    hasLoadedOnce,
    setHasLoadedOnce,
    fetchRevenue,
  }
}
