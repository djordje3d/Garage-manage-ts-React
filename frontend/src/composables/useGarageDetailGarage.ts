import { useCallback, useState } from 'react'
import { getGarage } from '../api/garages'
import type { Garage } from '../api/garages'

function isCanceled(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ERR_CANCELED'
}

export function useGarageDetailGarage(garageId: number | null) {
  const [garage, setGarage] = useState<Garage | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const fetchGarage = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const id = garageId
      if (!id) {
        setGarage(null)
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
        const res = await getGarage(id, { signal })
        setGarage(res.data)
        setError(false)
        setHasLoadedOnce(true)
      } catch (err: unknown) {
        if (isCanceled(err)) return
        setError(true)
        if (!hadData) setGarage(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [garageId, hasLoadedOnce],
  )

  return {
    garage,
    setGarage,
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    error,
    setError,
    hasLoadedOnce,
    setHasLoadedOnce,
    fetchGarage,
  }
}
