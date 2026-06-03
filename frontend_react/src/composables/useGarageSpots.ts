import { useCallback, useMemo, useState } from 'react'
import { listSpots } from '../api/spots'
import type { Spot } from '../api/spots'

function isCanceled(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ERR_CANCELED'
}

export function useGarageSpots(garageId: number | null) {
  const [spots, setSpots] = useState<Spot[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize])

  const fetchSpots = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const id = garageId
      if (!id) {
        setSpots([])
        setTotal(0)
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

      try {
        const res = await listSpots(
          {
            garage_id: id,
            active_only: false,
            limit: pageSize,
            offset,
          },
          { signal },
        )
        setSpots(res.data.items)
        setTotal(res.data.total)
        setError(false)
        setHasLoadedOnce(true)
      } catch (err: unknown) {
        if (isCanceled(err)) return
        setError(true)
        if (!hadData) {
          setSpots([])
          setTotal(0)
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [garageId, hasLoadedOnce, pageSize, offset],
  )

  return {
    spots,
    setSpots,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    setTotal,
    offset,
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    error,
    setError,
    hasLoadedOnce,
    setHasLoadedOnce,
    fetchSpots,
  }
}
