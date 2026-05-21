import { useTranslation } from 'react-i18next'
import { StatCard } from './StatCard'

export type StatusCardsProps = {
  freeSpots?: number
  occupiedSpots?: number
  inactiveSpots?: number
  openTickets?: number
  loading?: boolean
  refreshing?: boolean
  error?: boolean
  hasLoadedOnce?: boolean
  onRetry?: () => void
}

export function StatusCards({
  freeSpots = 0,
  occupiedSpots = 0,
  inactiveSpots = 0,
  openTickets = 0,
  loading = false,
  refreshing = false,
  error = false,
  hasLoadedOnce = false,
  onRetry,
}: StatusCardsProps) {
  const { t } = useTranslation()

  if (error) {
    return (
      <div className="dashboard-card h-full px-4 py-8" role="alert">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <button
            type="button"
            className="text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            onClick={onRetry}
          >
            Failed to fetch data, click here to retry
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="dashboard-card h-full px-4 py-12"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
          <span
            className="icon-spinner inline-block animate-spin text-2xl"
            aria-hidden="true"
          />
          <span>Loading data...</span>
        </div>
      </div>
    )
  }

  if (!hasLoadedOnce && !refreshing) {
    return (
      <div className="dashboard-card h-full px-4 py-12 text-center text-gray-400">
        —
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {refreshing ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/65 backdrop-blur-[1px]"
          aria-busy="true"
          aria-label="Refreshing"
        >
          <span
            className="icon-spinner inline-block animate-spin text-3xl text-gray-500"
            aria-hidden="true"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label={t('statusCards.freeSpots')}
          value={freeSpots}
          type="free"
          helpText={t('help.statusCards.freeSpots')}
          helpAriaLabel={t('help.aria.statusCard', {
            topic: t('statusCards.freeSpots'),
          })}
        />
        <StatCard
          label={t('statusCards.occupiedSpots')}
          value={occupiedSpots}
          type="occupied"
          helpText={t('help.statusCards.occupiedSpots')}
          helpAriaLabel={t('help.aria.statusCard', {
            topic: t('statusCards.occupiedSpots'),
          })}
        />
        <StatCard
          label={t('statusCards.inactiveSpots')}
          value={inactiveSpots}
          type="inactive"
          helpText={t('help.statusCards.inactiveSpots')}
          helpAriaLabel={t('help.aria.statusCard', {
            topic: t('statusCards.inactiveSpots'),
          })}
        />
        <StatCard
          label={t('statusCards.openTickets')}
          value={openTickets}
          type="tickets"
          helpText={t('help.statusCards.openTickets')}
          helpAriaLabel={t('help.aria.statusCard', {
            topic: t('statusCards.openTickets'),
          })}
        />
      </div>
    </div>
  )
}
