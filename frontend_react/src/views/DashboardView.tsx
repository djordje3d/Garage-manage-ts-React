import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StatusCards } from '../components/dashboard/StatusCards'
import { GarageOverviewTable } from '../components/dashboard/GarageOverviewTable'
import { TicketActivity } from '../components/dashboard/TicketActivity'
import { RevenueSummary } from '../components/dashboard/RevenueSummary'
import { GarageSelectDropdown } from '../components/dashboard/GarageSelectDropdown'
import { TimelineVehicleTypeChartBrush } from '../components/dashboard/TimelineVehicleTypeChartBrush'
import { StandardDropdown } from '../components/ui/StandardDropdown'
import { HelpTooltip } from '../components/ui/HelpTooltip'
import { listGarages } from '../api/garages'
import type { Garage } from '../api/garages'
import { getDashboardAnalytics } from '../api/dashboard'
import type { DashboardAnalytics } from '../api/dashboard'
import { listTicketsDashboard } from '../api/tickets'
import type { TicketDashboardRow } from '../api/tickets'
import { readGaragesCache, writeGaragesCache } from '../utils/garageCache'
import { getTodayISO, getMonthStartEnd } from '../utils/dashboardDates'
import {
  DASHBOARD_REQUEST_REFRESH_EVENT,
  DASHBOARD_WIDGET_FETCH_DONE,
} from '../constants/dashboardRefresh'
import {
  DASHBOARD_REFRESH_EVENT,
  DashboardRefreshAbortProvider,
} from '../contexts/dashboardRefresh'
import { useDashboardRefreshState } from '../composables/DashboardRefreshContext'
import { useToast } from '../composables/useToast'
import './dashboard-views.css'
import '../components/dashboard/dashboard-components.css'

const WIDGET_FETCH_TIMEOUT_MS = 15_000

function formatIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDateRange(timeFrame: string): { fromDate: string; toDate: string } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  const days =
    timeFrame === 'last7' ? 7 : timeFrame === 'last30' ? 30 : timeFrame === 'last90' ? 90 : 5
  start.setDate(end.getDate() - (days - 1))
  return { fromDate: formatIsoDate(start), toDate: formatIsoDate(end) }
}

function normalizeVehicleTypeKey(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'other'
}

export default function DashboardView() {
  const { t, i18n } = useTranslation()
  const { garageId: garageIdParam } = useParams<{ garageId?: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [garages, setGarages] = useState<Garage[]>([])
  const [selectedGarageId, setSelectedGarageId] = useState<number | null>(null)
  const garageWatchReady = useRef(false)

  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'timeline'>('overview')
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('realtime')

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(false)
  const [analyticsHasLoadedOnce, setAnalyticsHasLoadedOnce] = useState(false)

  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineRefreshing, setTimelineRefreshing] = useState(false)
  const [timelineError, setTimelineError] = useState(false)
  const [timelineHasLoadedOnce, setTimelineHasLoadedOnce] = useState(false)
  const [timelineRows, setTimelineRows] = useState<TicketDashboardRow[]>([])
  const [timelineYAxisMode, setTimelineYAxisMode] = useState<'entries' | 'exits'>('entries')
  const [timelineZoomStart, setTimelineZoomStart] = useState(0)
  const [timelineZoomEnd, setTimelineZoomEnd] = useState(0)

  const refreshEpoch = useRef(0)
  const refreshDepth = useRef(0)
  const refreshInProgress = useRef(false)
  const { getAbortSignal, prepareRefreshCycle } = useDashboardRefreshState()

  const analyticsHasLoadedOnceRef = useRef(false)
  const timelineHasLoadedOnceRef = useRef(false)
  const selectedGarageIdRef = useRef(selectedGarageId)
  const rangeRef = useRef(buildDateRange(selectedTimeFrame))
  const timelinePointsLengthRef = useRef(0)
  const timelineRowsLengthRef = useRef(0)
  const timelineZoomStartRef = useRef(0)
  const timelineZoomEndRef = useRef(0)

  useEffect(() => {
    analyticsHasLoadedOnceRef.current = analyticsHasLoadedOnce
  }, [analyticsHasLoadedOnce])

  useEffect(() => {
    timelineHasLoadedOnceRef.current = timelineHasLoadedOnce
  }, [timelineHasLoadedOnce])

  useEffect(() => {
    selectedGarageIdRef.current = selectedGarageId
  }, [selectedGarageId])

  const timeFrameOptions = useMemo(
    () => [
      { id: 'realtime', label: t('dashboard.timeFrameRealtime') },
      { id: 'last7', label: t('dashboard.timeFrameLast7') },
      { id: 'last30', label: t('dashboard.timeFrameLast30') },
      { id: 'last90', label: t('dashboard.timeFrameLast90') },
    ],
    [t],
  )

  const range = useMemo(
    () => buildDateRange(selectedTimeFrame),
    [selectedTimeFrame],
  )

  const timelinePoints = useMemo(() => {
    const points: string[] = []
    const start = new Date(`${range.fromDate}T00:00:00`)
    const end = new Date(`${range.toDate}T00:00:00`)
    const cur = new Date(start)
    while (cur <= end) {
      points.push(formatIsoDate(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return points
  }, [range])

  useEffect(() => {
    rangeRef.current = range
  }, [range])

  useEffect(() => {
    timelinePointsLengthRef.current = timelinePoints.length
  }, [timelinePoints.length])

  useEffect(() => {
    timelineRowsLengthRef.current = timelineRows.length
  }, [timelineRows.length])

  useEffect(() => {
    timelineZoomStartRef.current = timelineZoomStart
  }, [timelineZoomStart])

  useEffect(() => {
    timelineZoomEndRef.current = timelineZoomEnd
  }, [timelineZoomEnd])

  const localizeVehicleType = useCallback(
    (raw: string) => {
      const fallbackLabel = t('vehicleType.other')
      const trimmed = raw.trim()
      const key = `vehicleType.${normalizeVehicleTypeKey(trimmed)}`
      if (i18n.exists(key)) return t(key)
      return trimmed || fallbackLabel
    },
    [t, i18n],
  )

  const timelineSeries = useMemo(() => {
    void i18n.language
    const colorPalette = [
      'hsl(0, 60%, 68%)',
      'hsl(210, 60%, 68%)',
      'hsl(48, 60%, 62%)',
      'hsl(145, 50%, 60%)',
      'hsl(270, 55%, 68%)',
      'hsl(24, 65%, 64%)',
    ]
    const perType = new Map<string, { rawName: string; days: Record<string, number> }>()
    for (const row of timelineRows) {
      const daySource = timelineYAxisMode === 'entries' ? row.entry_time : row.exit_time
      const day = daySource ? daySource.slice(0, 10) : ''
      if (!day) continue
      const rawTypeName = row.vehicle_type?.trim() || ''
      const typeId = normalizeVehicleTypeKey(rawTypeName)
      if (!perType.has(typeId)) {
        perType.set(typeId, { rawName: rawTypeName, days: {} })
      }
      const bucket = perType.get(typeId)!.days
      bucket[day] = (bucket[day] ?? 0) + 1
    }
    return Array.from(perType.entries()).map(([id, info], idx) => ({
      id,
      name: localizeVehicleType(info.rawName),
      color: colorPalette[idx % colorPalette.length],
      values: timelinePoints.map((p) => info.days[p] ?? 0),
    }))
  }, [timelineRows, timelineYAxisMode, timelinePoints, localizeVehicleType, i18n.language])

  useEffect(() => {
    const maxIdx = Math.max(timelinePoints.length - 1, 0)
    const nextStart = Math.min(timelineZoomStartRef.current, maxIdx)
    let nextEnd = Math.min(Math.max(timelineZoomEndRef.current, nextStart), maxIdx)
    if (timelineHasLoadedOnceRef.current && nextEnd === 0 && maxIdx > 0) {
      nextEnd = maxIdx
    }
    setTimelineZoomStart(nextStart)
    setTimelineZoomEnd(nextEnd)
  }, [timelinePoints])

  useEffect(() => {
    if (garageIdParam !== undefined && garageIdParam !== '') {
      const n = Number.parseInt(garageIdParam, 10)
      if (!Number.isFinite(n) || n <= 0) {
        navigate('/dashboard', { replace: true })
        return
      }
      setSelectedGarageId(n)
    } else {
      setSelectedGarageId(null)
    }
  }, [garageIdParam, navigate])

  const onGarageSelect = (v: number | null) => {
    if (v == null && (garageIdParam == null || garageIdParam === '')) return
    if (v != null && garageIdParam === String(v)) return
    if (v == null) navigate('/dashboard')
    else navigate(`/dashboard/${v}`)
  }

  const waitForTwoWidgetFetches = useCallback((epoch: number) => {
    return new Promise<void>((resolve) => {
      let received = 0
      const onDone = (e: Event) => {
        const d = (e as CustomEvent<{ epoch?: number }>).detail
        if (d?.epoch !== epoch) return
        received++
        if (received >= 2) {
          cleanup()
          resolve()
        }
      }
      const cleanup = () => {
        window.removeEventListener(DASHBOARD_WIDGET_FETCH_DONE, onDone)
        clearTimeout(tid)
      }
      const tid = setTimeout(() => {
        cleanup()
        resolve()
      }, WIDGET_FETCH_TIMEOUT_MS)
      window.addEventListener(DASHBOARD_WIDGET_FETCH_DONE, onDone)
    })
  }, [])

  const reconcileGarageSelection = useCallback(async () => {
    const hasGarageParam = garageIdParam !== undefined && garageIdParam !== ''
    if (
      selectedGarageId != null &&
      garages.length > 0 &&
      !garages.some((g) => g.id === selectedGarageId)
    ) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (garages.length === 1 && !hasGarageParam) {
      navigate(`/dashboard/${garages[0].id}`, { replace: true })
    }
  }, [selectedGarageId, garages, garageIdParam, navigate])

  const loadGarages = useCallback(async () => {
    const cached = readGaragesCache()
    if (cached?.fresh) {
      setGarages(cached.items)
      await reconcileGarageSelection()
      return
    }
    try {
      const res = await listGarages({ limit: 200 })
      setGarages(res.data.items)
      writeGaragesCache(res.data.items)
      await reconcileGarageSelection()
    } catch {
      setGarages([])
    }
  }, [reconcileGarageSelection])

  const fetchAnalyticsOnly = useCallback(async () => {
    const hasData = analyticsHasLoadedOnceRef.current
    if (!hasData) {
      setAnalyticsLoading(true)
      setAnalyticsError(false)
    } else {
      setAnalyticsRefreshing(true)
    }
    const signal = getAbortSignal() ?? undefined
    const config = signal ? { signal } : undefined
    const today = getTodayISO()
    const { from: monthFrom, to: monthTo } = getMonthStartEnd()
    try {
      const res = await getDashboardAnalytics(
        {
          garage_id: selectedGarageIdRef.current ?? undefined,
          today,
          month_from: monthFrom,
          month_to: monthTo,
        },
        config,
      )
      setAnalytics(res.data)
      setAnalyticsError(false)
      analyticsHasLoadedOnceRef.current = true
      setAnalyticsHasLoadedOnce(true)
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'ERR_CANCELED') return
      setAnalyticsError(true)
      if (!hasData) setAnalytics(null)
    } finally {
      setAnalyticsLoading(false)
      setAnalyticsRefreshing(false)
    }
  }, [getAbortSignal])

  const fetchTimelineOnly = useCallback(async () => {
    const hasData =
      timelineRowsLengthRef.current > 0 || timelineHasLoadedOnceRef.current
    if (!hasData) {
      setTimelineLoading(true)
      setTimelineError(false)
    } else {
      setTimelineRefreshing(true)
    }
    const signal = getAbortSignal() ?? undefined
    const config = signal ? { signal } : undefined
    const { fromDate, toDate } = rangeRef.current
    try {
      const res = await listTicketsDashboard(
        {
          ...(selectedGarageIdRef.current != null
            ? { garage_id: selectedGarageIdRef.current }
            : {}),
          from_date: fromDate,
          to_date: toDate,
          limit: 5000,
          offset: 0,
        },
        config,
      )
      setTimelineRows(res.data.items)
      setTimelineError(false)
      const maxIdx = Math.max(timelinePointsLengthRef.current - 1, 0)
      if (!timelineHasLoadedOnceRef.current || timelineZoomEndRef.current === 0) {
        setTimelineZoomStart(0)
        setTimelineZoomEnd(maxIdx)
      }
      timelineHasLoadedOnceRef.current = true
      setTimelineHasLoadedOnce(true)
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'ERR_CANCELED') return
      setTimelineError(true)
      if (!hasData) setTimelineRows([])
    } finally {
      setTimelineLoading(false)
      setTimelineRefreshing(false)
    }
  }, [getAbortSignal])

  const runRefreshCycle = useCallback(async () => {
    refreshDepth.current++
    refreshInProgress.current = true
    try {
      refreshEpoch.current++
      const epoch = refreshEpoch.current
      prepareRefreshCycle()
      const analyticsP = fetchAnalyticsOnly()
      const widgetsP = waitForTwoWidgetFetches(epoch)
      const timelineP = fetchTimelineOnly()
      window.dispatchEvent(
        new CustomEvent(DASHBOARD_REFRESH_EVENT, { detail: { epoch } }),
      )
      await Promise.all([analyticsP, widgetsP, timelineP])
    } finally {
      refreshDepth.current--
      if (refreshDepth.current === 0) refreshInProgress.current = false
    }
  }, [prepareRefreshCycle, fetchAnalyticsOnly, waitForTwoWidgetFetches, fetchTimelineOnly])

  const refreshAll = useCallback(() => {
    void runRefreshCycle()
  }, [runRefreshCycle])

  const refreshAllRef = useRef(refreshAll)
  refreshAllRef.current = refreshAll

  useEffect(() => {
    toast.clearToast()
    void loadGarages().then(() => {
      refreshAllRef.current()
      garageWatchReady.current = true
    })
    const onRequest = () => refreshAllRef.current()
    window.addEventListener(DASHBOARD_REQUEST_REFRESH_EVENT, onRequest)
    return () => {
      window.removeEventListener(DASHBOARD_REQUEST_REFRESH_EVENT, onRequest)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!garageWatchReady.current) return
    refreshAllRef.current()
  }, [selectedGarageId])

  useEffect(() => {
    if (!garageWatchReady.current) return
    refreshAllRef.current()
  }, [selectedTimeFrame])

  useEffect(() => {
    const maxIdx = Math.max(timelinePoints.length - 1, 0)
    const nextStart = Math.min(timelineZoomStartRef.current, maxIdx)
    const nextEnd = Math.min(Math.max(timelineZoomEndRef.current, nextStart), maxIdx)
    setTimelineZoomStart(nextStart)
    setTimelineZoomEnd(nextEnd)
  }, [timelineYAxisMode, timelinePoints.length])

  return (
    <DashboardRefreshAbortProvider getSignal={getAbortSignal}>
      <div className="dashboard-sections">
        <div className="dashboard-layout-lg lg:items-stretch lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="dashboard-fade dashboard-fade--1 h-full lg:col-span-5">
            <StatusCards
              freeSpots={analytics?.free_spots ?? 0}
              occupiedSpots={analytics?.occupied_spots ?? 0}
              inactiveSpots={analytics?.inactive_spots ?? 0}
              openTickets={analytics?.open_tickets ?? 0}
              loading={analyticsLoading && !analyticsHasLoadedOnce}
              refreshing={analyticsRefreshing}
              error={analyticsError}
              hasLoadedOnce={analyticsHasLoadedOnce}
              onRetry={() => {
                setAnalyticsRefreshing(true)
                void fetchAnalyticsOnly()
              }}
            />
          </div>
          <div className="by-garage-card dashboard-card shaddow-none dashboard-fade dashboard-fade--0 h-full p-4 lg:col-span-3">
            <GarageSelectDropdown
              modelValue={selectedGarageId}
              garages={garages}
              onModelValueChange={(v) => onGarageSelect(v as number | null)}
            />
          </div>
          <div className="dashboard-fade dashboard-fade--4 h-full lg:col-span-4">
            <RevenueSummary
              className="h-full"
              todayRevenue={analytics?.today_revenue ?? 0}
              monthRevenue={analytics?.month_revenue ?? 0}
              unpaidCount={analytics?.unpaid_partially_paid_count ?? 0}
              totalOutstanding={analytics?.total_outstanding ?? 0}
              loading={analyticsLoading && !analyticsHasLoadedOnce}
              refreshing={analyticsRefreshing}
              error={analyticsError}
              hasLoadedOnce={analyticsHasLoadedOnce}
              onRetry={() => {
                setAnalyticsRefreshing(true)
                void fetchAnalyticsOnly()
              }}
            />
          </div>
        </div>

        <div className="dashboard-fade dashboard-fade--2">
          <div className="dashboard-card px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="dashboard-tabs gap-5">
                <button
                  type="button"
                  className={`dashboard-tab${activeTab === 'overview' ? ' dashboard-tab--active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  {t('dashboard.tabOverview')}
                </button>
                <button
                  type="button"
                  className={`dashboard-tab${activeTab === 'tickets' ? ' dashboard-tab--active' : ''}`}
                  onClick={() => setActiveTab('tickets')}
                >
                  {t('dashboard.tabTickets')}
                </button>
                <button
                  type="button"
                  className={`dashboard-tab${activeTab === 'timeline' ? ' dashboard-tab--active' : ''}`}
                  onClick={() => setActiveTab('timeline')}
                >
                  {t('dashboard.tabTimeline')}
                </button>
              </div>
              {activeTab !== 'overview' ? (
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

        <div className="dashboard-fade dashboard-fade--3">
          <div className={activeTab === 'overview' ? undefined : 'hidden'}>
            <GarageOverviewTable
              garageId={selectedGarageId ?? undefined}
              refreshKey={selectedTimeFrame}
            />
          </div>
          <div className={activeTab === 'tickets' ? undefined : 'hidden'}>
            <TicketActivity
              garageId={selectedGarageId ?? undefined}
              fromDate={range.fromDate}
              toDate={range.toDate}
            />
          </div>
          <div className={activeTab === 'timeline' ? undefined : 'hidden'}>
            <TimelineVehicleTypeChartBrush
              fromDate={range.fromDate}
              toDate={range.toDate}
              points={timelinePoints}
              series={timelineSeries}
              yAxisMode={timelineYAxisMode}
              loading={timelineLoading}
              refreshing={timelineRefreshing}
              error={timelineError}
              hasLoadedOnce={timelineHasLoadedOnce}
              zoomStart={timelineZoomStart}
              zoomEnd={timelineZoomEnd}
              onYAxisModeChange={setTimelineYAxisMode}
              onZoomStartChange={setTimelineZoomStart}
              onZoomEndChange={setTimelineZoomEnd}
            />
          </div>
        </div>
      </div>
    </DashboardRefreshAbortProvider>
  )
}
