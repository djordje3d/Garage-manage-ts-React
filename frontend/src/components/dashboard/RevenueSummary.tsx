import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../composables/useFormatters'
import { SummaryRow } from './SummaryRow'

export type RevenueSummaryProps = {
  className?: string
  todayRevenue?: number
  monthRevenue?: number
  unpaidCount?: number
  totalOutstanding?: number
  loading?: boolean
  refreshing?: boolean
  error?: boolean
  hasLoadedOnce?: boolean
  onRetry?: () => void
}

export function RevenueSummary({
  className = '',
  todayRevenue = 0,
  monthRevenue = 0,
  unpaidCount = 0,
  totalOutstanding = 0,
  loading = false,
  refreshing = false,
  error = false,
  hasLoadedOnce = false,
  onRetry,
}: RevenueSummaryProps) {
  const { t } = useTranslation()

  return (
    <div className={`dashboard-card p-4 ${className}`.trim()}>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        {t('paymentsRevenue.title')}
      </h2>

      {error ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-8 text-center"
          role="alert"
        >
          <button
            type="button"
            className="text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            onClick={onRetry}
          >
            Failed to fetch data, click here to retry
          </button>
        </div>
      ) : loading ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500"
          aria-busy="true"
          aria-live="polite"
        >
          <span
            className="icon-spinner5 inline-block text-2xl animate-spin"
            aria-hidden="true"
          />
          <span>loading data...</span>
        </div>
      ) : !hasLoadedOnce && !refreshing ? (
        <div className="py-12 text-center text-gray-400">—</div>
      ) : (
        <div className="relative min-h-[100px]">
          {refreshing ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70"
              aria-busy="true"
              aria-label="Refreshing"
            >
              <span
                className="icon-spinner3 inline-block text-3xl animate-spin text-gray-500"
                aria-hidden="true"
              />
            </div>
          ) : null}

          <div className="space-y-4">
            <SummaryRow
              label={t('paymentsRevenue.todayRevenue')}
              value={formatMoney(todayRevenue)}
            />
            <SummaryRow
              label={t('paymentsRevenue.thisMonthRevenue')}
              value={formatMoney(monthRevenue)}
            />
            <SummaryRow
              label={t('paymentsRevenue.unpaidPartiallyPaidTickets')}
              value={unpaidCount}
              valueClass="text-amber-700"
            />
            <SummaryRow
              label={t('paymentsRevenue.restToPayDescription')}
              value={formatMoney(totalOutstanding)}
              valueClass="text-amber-700"
            />
          </div>
        </div>
      )}
    </div>
  )
}
