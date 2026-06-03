import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RevenueSummary } from '../components/dashboard/RevenueSummary'
import { HelpTooltip } from '../components/ui/HelpTooltip'
import { StandardDropdown } from '../components/ui/StandardDropdown'
import { GarageHeaderCard } from '../components/dashboard/GarageHeaderCard'
import { GarageSpotsTable } from '../components/dashboard/GarageSpotsTable'
import { GarageOpenTicketsTable } from '../components/dashboard/GarageOpenTicketsTable'
import { DASHBOARD_REQUEST_REFRESH_EVENT } from '../constants/dashboardRefresh'
import {
  DashboardRefreshProvider,
} from '../composables/DashboardRefreshContext'
import { useGarageDetailContext } from '../composables/useGarageDetailContext'
import { useGarageDetailGarage } from '../composables/useGarageDetailGarage'
import { useGarageRevenue } from '../composables/useGarageRevenue'
import { useGarageSpots } from '../composables/useGarageSpots'
import { useGarageOpenTickets } from '../composables/useGarageOpenTickets'
import { DashboardRefreshAbortProvider } from '../contexts/dashboardRefresh'
import './dashboard-views.css'
import '../components/dashboard/dashboard-components.css'

export default function GarageDetailView() {
  const { t } = useTranslation()
  const { garageId, dashboardRefresh, prepareRefreshCycle } = useGarageDetailContext()
  const fallbackId = useMemo(() => String(garageId ?? ''), [garageId])

  const [activeDetailTab, setActiveDetailTab] = useState<'spots' | 'tickets'>('spots')
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('realtime')

  const garageSec = useGarageDetailGarage(garageId)
  const revenueSec = useGarageRevenue(garageId)
  const spotsSec = useGarageSpots(garageId)
  const ticketsSec = useGarageOpenTickets(garageId)

  const refreshDepth = useRef(0)
  const refreshInProgress = useRef(false)
  const spotsPagAbort = useRef<AbortController | null>(null)
  const ticketsPagAbort = useRef<AbortController | null>(null)

  const timeFrameOptions = useMemo(
    () => [
      { id: 'realtime', label: t('dashboard.timeFrameRealtime') },
      { id: 'last7', label: t('dashboard.timeFrameLast7') },
      { id: 'last30', label: t('dashboard.timeFrameLast30') },
      { id: 'last90', label: t('dashboard.timeFrameLast90') },
    ],
    [t],
  )

  const runRefreshCycle = async () => {
    const id = garageId
    if (!id) return
    refreshDepth.current++
    refreshInProgress.current = true
    spotsSec.setPage(1)
    ticketsSec.setPage(1)
    const signal = prepareRefreshCycle()
    try {
      await Promise.all([
        garageSec.fetchGarage(signal),
        revenueSec.fetchRevenue(signal),
        spotsSec.fetchSpots(signal),
        ticketsSec.fetchOpenTickets(signal),
      ])
    } finally {
      refreshDepth.current--
      if (refreshDepth.current === 0) refreshInProgress.current = false
    }
  }

  const pollRefresh = () => {
    if (refreshInProgress.current) return
    void runRefreshCycle()
  }

  const refreshNow = () => void runRefreshCycle()

  useEffect(() => {
    const onGlobal = () => pollRefresh()
    window.addEventListener(DASHBOARD_REQUEST_REFRESH_EVENT, onGlobal)
    return () => window.removeEventListener(DASHBOARD_REQUEST_REFRESH_EVENT, onGlobal)
  }, [])

  useEffect(() => {
    if (!garageId) {
      garageSec.setGarage(null)
      revenueSec.setRevenueDash(null)
      spotsSec.setSpots([])
      spotsSec.setTotal(0)
      ticketsSec.setOpenTickets([])
      ticketsSec.setTotal(0)
      return
    }
    void runRefreshCycle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageId])

  useEffect(() => {
    if (!garageId || !garageSec.hasLoadedOnce || refreshInProgress.current) return
    spotsPagAbort.current?.abort()
    spotsPagAbort.current = new AbortController()
    void spotsSec.fetchSpots(spotsPagAbort.current.signal)
  }, [spotsSec.page, spotsSec.pageSize])

  useEffect(() => {
    if (!garageId || !garageSec.hasLoadedOnce || refreshInProgress.current) return
    ticketsPagAbort.current?.abort()
    ticketsPagAbort.current = new AbortController()
    void ticketsSec.fetchOpenTickets(ticketsPagAbort.current.signal)
  }, [ticketsSec.page, ticketsSec.pageSize])

  useEffect(() => {
    if (!garageId || !garageSec.hasLoadedOnce || refreshInProgress.current) return
    if (activeDetailTab !== 'tickets') return
    ticketsSec.setPage(1)
    ticketsPagAbort.current?.abort()
    ticketsPagAbort.current = new AbortController()
    void ticketsSec.fetchOpenTickets(ticketsPagAbort.current.signal)
  }, [selectedTimeFrame])

  const retryRevenue = async () => {
    if (!garageId || refreshInProgress.current) return
    const c = new AbortController()
    await revenueSec.fetchRevenue(c.signal)
  }

  const retrySpots = () => {
    if (!garageId || refreshInProgress.current) return
    spotsPagAbort.current?.abort()
    spotsPagAbort.current = new AbortController()
    void spotsSec.fetchSpots(spotsPagAbort.current.signal)
  }

  const retryOpenTickets = () => {
    if (!garageId || refreshInProgress.current) return
    ticketsPagAbort.current?.abort()
    ticketsPagAbort.current = new AbortController()
    void ticketsSec.fetchOpenTickets(ticketsPagAbort.current.signal)
  }

  const anyRefreshing =
    garageSec.refreshing ||
    revenueSec.refreshing ||
    spotsSec.refreshing ||
    ticketsSec.refreshing

  return (
    <DashboardRefreshProvider value={dashboardRefresh}>
      <DashboardRefreshAbortProvider getSignal={dashboardRefresh.getAbortSignal}>
        <div className="dashboard-sections">
          {!garageId ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm">
              {t('garageDetail.invalidGarageId')}
            </div>
          ) : garageSec.loading && !garageSec.hasLoadedOnce ? (
            <>
              <section className="dashboard-card overflow-hidden">
                <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                        {t('garageDetail.dashboard')}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                        {t('garageDetail.loading')}
                      </span>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                        {t('garageDetail.garage')} #{fallbackId}
                      </h1>
                      <p className="mt-1 text-sm text-slate-500">{t('garageDetail.loading')}</p>
                    </div>
                  </div>
                </div>
              </section>
              <div className="dashboard-layout-lg lg:items-stretch lg:grid lg:grid-cols-12 lg:gap-6">
                <div className="h-full lg:col-span-7">
                  <GarageHeaderCard
                    garage={garageSec.garage}
                    fallbackId={fallbackId}
                    refreshing={garageSec.refreshing}
                  />
                </div>
                <div className="lg:col-span-5">
                  <RevenueSummary
                    todayRevenue={revenueSec.revenueDash?.today_revenue ?? 0}
                    monthRevenue={revenueSec.revenueDash?.month_revenue ?? 0}
                    unpaidCount={revenueSec.revenueDash?.unpaid_partially_paid_count ?? 0}
                    totalOutstanding={revenueSec.revenueDash?.total_outstanding ?? 0}
                    loading={revenueSec.loading && !revenueSec.hasLoadedOnce}
                    refreshing={revenueSec.refreshing}
                    error={revenueSec.error}
                    hasLoadedOnce={revenueSec.hasLoadedOnce}
                    onRetry={() => void retryRevenue()}
                  />
                </div>
              </div>
              <div className="text-slate-500">{t('garageDetail.loading')}</div>
            </>
          ) : garageSec.error && !garageSec.garage ? (
            <>
              <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
                <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {t('garageDetail.garage')} #{fallbackId}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">{t('garageDetail.loadFailed')}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100"
                    onClick={refreshNow}
                  >
                    {t('garageDetail.retryBtn')}
                  </button>
                </div>
              </section>
              <GarageHeaderCard
                garage={garageSec.garage}
                fallbackId={fallbackId}
                refreshing={garageSec.refreshing}
              />
              <div
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700 shadow-sm"
                role="alert"
              >
                <p className="mb-2 font-medium">{t('garageDetail.loadFailed')}</p>
                <button type="button" className="underline" onClick={refreshNow}>
                  {t('garageDetail.retryBtn')}
                </button>
              </div>
            </>
          ) : !garageSec.garage ? (
            <section className="flex flex-col gap-4 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-sm">
              <GarageHeaderCard
                garage={garageSec.garage}
                fallbackId={fallbackId}
                refreshing={garageSec.refreshing}
              />
              <div>{t('garageDetail.garageNotFound')}</div>
            </section>
          ) : (
            <>
              <section className="garage-detail-fade garage-detail-fade--1">
                <div className="space-y-3 px-0 py-2">
                  <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center rounded-full bg-slate-100 text-base px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
                    >
                      &larr; {t('garageDetail.dashboard')}
                    </Link>
                    {anyRefreshing ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                        {t('common.refreshing')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 text-base px-3 py-1 font-medium text-slate-700">
                        {t('garageDetail.liveOverview')}
                      </span>
                    )}
                  </div>
                  <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {garageSec.garage.name}
                  </h1>
                </div>
              </section>

              <div className="dashboard-layout-lg lg:items-stretch lg:grid lg:grid-cols-12 lg:gap-6">
                <div className="garage-detail-fade garage-detail-fade--2 h-full lg:col-span-7">
                  <GarageHeaderCard
                    garage={garageSec.garage}
                    fallbackId={fallbackId}
                    refreshing={garageSec.refreshing}
                  />
                </div>
                <div className="garage-detail-fade garage-detail-fade--3 lg:col-span-5">
                  <RevenueSummary
                    todayRevenue={revenueSec.revenueDash?.today_revenue ?? 0}
                    monthRevenue={revenueSec.revenueDash?.month_revenue ?? 0}
                    unpaidCount={revenueSec.revenueDash?.unpaid_partially_paid_count ?? 0}
                    totalOutstanding={revenueSec.revenueDash?.total_outstanding ?? 0}
                    loading={revenueSec.loading && !revenueSec.hasLoadedOnce}
                    refreshing={revenueSec.refreshing}
                    error={revenueSec.error}
                    hasLoadedOnce={revenueSec.hasLoadedOnce}
                    onRetry={() => void retryRevenue()}
                  />
                </div>
              </div>

              <div className="garage-detail-fade garage-detail-fade--4">
                <div className="dashboard-card px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="dashboard-tabs gap-5">
                      <button
                        type="button"
                        className={`dashboard-tab${activeDetailTab === 'spots' ? ' dashboard-tab--active' : ''}`}
                        onClick={() => setActiveDetailTab('spots')}
                      >
                        {t('garageDetail.spots')}
                      </button>
                      <button
                        type="button"
                        className={`dashboard-tab${activeDetailTab === 'tickets' ? ' dashboard-tab--active' : ''}`}
                        onClick={() => setActiveDetailTab('tickets')}
                      >
                        {t('garageDetail.openTickets')}
                      </button>
                    </div>
                    {activeDetailTab === 'tickets' ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <div className="flex shrink-0 items-baseline gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            {t('dashboard.timeFrame')}
                          </span>
                          <HelpTooltip
                            asIcon
                            text={t('help.dashboard.timeFrame')}
                            ariaLabel={t('help.aria.timeFrame')}
                          />
                        </div>
                        <div className="w-[220px] min-w-[10rem] max-w-full shrink-0">
                          <StandardDropdown
                            label=""
                            options={timeFrameOptions}
                            modelValue={selectedTimeFrame}
                            nullable={false}
                            onModelValueChange={(v) =>
                              setSelectedTimeFrame((v as string) ?? 'realtime')
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="garage-detail-fade garage-detail-fade--5">
                {activeDetailTab === 'spots' ? (
                  <GarageSpotsTable
                    spots={spotsSec.spots}
                    page={spotsSec.page}
                    pageSize={spotsSec.pageSize}
                    total={spotsSec.total}
                    loading={spotsSec.loading}
                    refreshing={spotsSec.refreshing}
                    error={spotsSec.error}
                    hasLoadedOnce={spotsSec.hasLoadedOnce}
                    onRetry={retrySpots}
                    onPageChange={spotsSec.setPage}
                  />
                ) : (
                  <GarageOpenTicketsTable
                    openTickets={ticketsSec.openTickets}
                    page={ticketsSec.page}
                    pageSize={ticketsSec.pageSize}
                    total={ticketsSec.total}
                    loading={ticketsSec.loading}
                    refreshing={ticketsSec.refreshing}
                    error={ticketsSec.error}
                    hasLoadedOnce={ticketsSec.hasLoadedOnce}
                    onRetry={retryOpenTickets}
                    onPageChange={ticketsSec.setPage}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </DashboardRefreshAbortProvider>
    </DashboardRefreshProvider>
  )
}
