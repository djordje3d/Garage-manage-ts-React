import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getGarageOverview } from '../../api/garages'
import { DASHBOARD_WIDGET_FETCH_DONE } from '../../constants/dashboardRefresh'
import {
  DASHBOARD_REFRESH_EVENT,
  useDashboardRefreshAbortSignal,
} from '../../contexts/dashboardRefresh'
import { ButtonIn } from '../ui/ButtonIn'

interface Row {
  garage_id: number
  name: string
  total_spots: number
  free: number
  occupied: number
  rentable: number
}

export type GarageOverviewTableProps = {
  garageId?: number | null
  refreshKey?: string
}

export function GarageOverviewTable({
  garageId,
  refreshKey = '',
}: GarageOverviewTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dashboardRefreshAbortSignal = useDashboardRefreshAbortSignal()

  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const fetchData = useCallback(
    async (refreshEpoch?: number) => {
      const hasData = rows.length > 0 || hasLoadedOnce

      if (!hasData) {
        setLoading(true)
        setError(false)
      } else {
        setRefreshing(true)
      }

      const signal = dashboardRefreshAbortSignal ?? undefined
      const config = signal ? { signal } : undefined

      try {
        const res = await getGarageOverview(garageId ?? undefined, config)
        setRows(
          res.data.map((r) => ({
            garage_id: r.garage_id,
            name: r.name,
            total_spots: r.total_spots,
            free: r.free_spots,
            occupied: r.occupied_spots,
            rentable: r.rentable_spots,
          })),
        )
        setHasLoadedOnce(true)
        setError(false)
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === 'ERR_CANCELED') return
        setError(true)
        if (!hasData) setRows([])
      } finally {
        setLoading(false)
        setRefreshing(false)
        if (refreshEpoch != null && refreshEpoch > 0) {
          window.dispatchEvent(
            new CustomEvent(DASHBOARD_WIDGET_FETCH_DONE, {
              detail: { epoch: refreshEpoch },
            }),
          )
        }
      }
    },
    [dashboardRefreshAbortSignal, garageId, hasLoadedOnce, rows.length],
  )

  const retry = useCallback(() => {
    setError(false)
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const onDashboardRefresh = (e: Event) => {
      const epoch = (e as CustomEvent<{ epoch?: number }>).detail?.epoch
      void fetchData(epoch)
    }

    window.addEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh)
    void fetchData()

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh)
    }
  }, [fetchData, refreshKey])

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('garageOverview.title')}
        </h2>
      </div>

      <div className="overflow-x-auto">
        {error ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
            role="alert"
          >
            <ButtonIn
              id="retryBtn"
              label={t('garageOverview.failedToFetchData')}
              variant="outline"
              onUserClick={retry}
              caption={t('garageOverview.retry')}
            />
          </div>
        ) : loading ? (
          <div
            className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-gray-500"
            aria-busy="true"
            aria-live="polite"
          >
            <span
              className="icon-spinner11 inline-block text-2xl animate-spin"
              aria-hidden="true"
            />
            <span>{t('garageOverview.loading')}</span>
          </div>
        ) : !hasLoadedOnce && !refreshing ? (
          <div className="px-4 py-12 text-center text-gray-400">—</div>
        ) : (
          <div className="relative min-h-[120px]">
            {refreshing ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
                aria-busy="true"
                aria-label="Refreshing"
              >
                <span
                  className="icon-spinner2 inline-block text-3xl animate-spin text-gray-500"
                  aria-hidden="true"
                />
              </div>
            ) : null}

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {t('garageOverview.garage')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    {t('garageOverview.garageTotalSpots')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    {t('garageOverview.free')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    {t('garageOverview.occupied')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    {t('garageOverview.rentable')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rows.map((row) => (
                  <tr
                    key={row.garage_id}
                    className={
                      garageId ? '' : 'cursor-pointer hover:bg-gray-50'
                    }
                    onClick={() => {
                      if (!garageId) {
                        navigate(`/garage/${row.garage_id}`)
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {row.total_spots}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {row.free}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {row.occupied}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {row.rentable}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      {t('garageOverview.noGarages')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
