import { useTranslation } from 'react-i18next'
import type { Spot } from '../../api/spots'
import { PaginationBar } from '../ui/PaginationBar'

export type GarageSpotsTableProps = {
  spots: Spot[]
  page: number
  pageSize: number
  total: number
  loading: boolean
  refreshing: boolean
  error: boolean
  hasLoadedOnce: boolean
  onRetry?: () => void
  onPageChange?: (page: number) => void
}

export function GarageSpotsTable({
  spots,
  page,
  pageSize,
  total,
  loading,
  refreshing,
  error,
  hasLoadedOnce,
  onRetry,
  onPageChange,
}: GarageSpotsTableProps) {
  const { t } = useTranslation()

  return (
    <section className="dashboard-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t('garageOverview.garage')}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {t('garageDetail.spots')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('garageSpots.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
              {t('garageSpots.totalCount', { count: total })}
            </span>

            {refreshing ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                {t('common.refreshing')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="px-5 py-6 sm:px-6" role="alert">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <p className="text-base font-medium text-red-700">
              {t('garageSpots.loadFailed')}
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              onClick={onRetry}
            >
              {t('garageDetail.retryBtn')}
            </button>
          </div>
        </div>
      ) : loading && !hasLoadedOnce ? (
        <div className="px-5 py-6 sm:px-6" aria-busy="true">
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-slate-500">
            <span
              className="icon-spinner5 inline-block animate-spin text-3xl"
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{t('garageDetail.loading')}</span>
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="relative overflow-x-auto">
            {refreshing ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]"
                aria-busy="true"
              >
                <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                  <span
                    className="icon-spinner3 inline-block animate-spin text-lg text-slate-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-600">
                    {t('common.refreshing')}
                  </span>
                </div>
              </div>
            ) : null}

            <table className="min-w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('garageDetail.spot')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('garageDetail.spotOccupancy')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('garageDetail.rentableSpots')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('garageDetail.activeSpots')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {spots.map((s) => (
                  <tr key={s.id} className="transition hover:bg-slate-50">
                    <td className="border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
                      {s.code}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-sm">
                      <span className="whitespace-nowrap border-t border-slate-100 px-4 py-3 text-sm text-gray-700">
                        {s.is_occupied
                          ? t('garageDetail.spotOccupied')
                          : t('garageDetail.spotFree')}
                      </span>
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-sm">
                      <span className="whitespace-nowrap border-t border-slate-100 px-4 py-3 text-sm text-gray-700">
                        {s.is_rentable ? t('garageDetail.yes') : t('garageDetail.no')}
                      </span>
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-sm">
                      <span className="whitespace-nowrap border-t border-slate-100 px-4 py-3 text-sm text-gray-700">
                        {s.is_active ? t('garageDetail.yes') : t('garageDetail.no')}
                      </span>
                    </td>
                  </tr>
                ))}
                {spots.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-0">
                      <div className="mx-2 my-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                        <p className="text-base font-medium text-slate-700">
                          {t('garageDetail.noSpots')}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          There are no parking spots to display right now.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}
    </section>
  )
}
