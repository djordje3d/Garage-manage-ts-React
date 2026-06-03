import { useCallback, useMemo, useState } from 'react'
import { listTicketsDashboard } from '../api/tickets'
import type { TicketDashboardRow } from '../api/tickets'

function isCanceled(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ERR_CANCELED'
}

export function useGarageOpenTickets(garageId: number | null) {
  const [openTickets, setOpenTickets] = useState<TicketDashboardRow[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize])

  const fetchOpenTickets = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const id = garageId
      if (!id) {
        setOpenTickets([])
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
        const res = await listTicketsDashboard(
          {
            garage_id: id,
            ticket_state: 'OPEN',
            limit: pageSize,
            offset,
          },
          { signal },
        )
        setOpenTickets(res.data.items)
        setTotal(res.data.total)
        setError(false)
        setHasLoadedOnce(true)
      } catch (err: unknown) {
        if (isCanceled(err)) return
        setError(true)
        if (!hadData) {
          setOpenTickets([])
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
    openTickets,
    setOpenTickets,
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
    fetchOpenTickets,
  }
}
