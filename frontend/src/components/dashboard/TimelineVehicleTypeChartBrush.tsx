import {
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  TIMELINE_LAYOUT,
  buildSmoothInterpolatedPath,
  clamp,
  createRafThrottled,
  indexFromClientX,
  mapIndexToOverviewX,
  maxFromAll,
  percentForIndex,
  type PlotPoint,
  type TimelineSeries,
} from '../../composables/timelineChart.utils'
import useTimelineMainChartState from '../../composables/useTimelineMainChartState'
import { HelpTooltip } from '../ui/HelpTooltip'
import { StandardDropdown } from '../ui/StandardDropdown'
import './dashboard-components.css'

type DragMode = 'move' | 'start' | 'end'

export type TimelineVehicleTypeChartBrushProps = {
  fromDate: string
  toDate: string
  points: string[]
  series: TimelineSeries[]
  loading: boolean
  refreshing: boolean
  error: boolean
  hasLoadedOnce: boolean
  yAxisMode: 'entries' | 'exits'
  zoomStart?: number
  zoomEnd?: number
  onZoomStartChange?: (value: number) => void
  onZoomEndChange?: (value: number) => void
  onYAxisModeChange?: (value: 'entries' | 'exits') => void
}

export function TimelineVehicleTypeChartBrush({
  fromDate,
  toDate,
  points,
  series,
  loading,
  refreshing,
  error,
  hasLoadedOnce,
  yAxisMode,
  zoomStart = 0,
  zoomEnd = 0,
  onZoomStartChange,
  onZoomEndChange,
  onYAxisModeChange,
}: TimelineVehicleTypeChartBrushProps) {
  const { t } = useTranslation()
  const brushRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    mode: DragMode
    pointerId: number
    originIndex: number
    startAtDown: number
    endAtDown: number
  } | null>(null)

  const {
    chartRef,
    yAxisOptions,
    visibleSeries,
    alignedSeries,
    safeZoomStart,
    safeZoomEnd,
    visiblePoints,
    activeSeries,
    mainGridLines,
    xAxisTicks,
    visibleLines,
    hoverIndex,
    hoverX,
    tooltipRows,
    tooltipLeft,
    formatXAxisLabel,
    toggleSeries,
    clearHover,
    setHoverFromMouse,
  } = useTimelineMainChartState({
    points,
    series,
    zoomStart,
    zoomEnd,
    t: (key: string) => t(key),
    gridSecondaryStroke: '#eef2f7',
  })

  const overviewMaxY = useMemo(() => {
    const raw = maxFromAll(activeSeries)
    if (raw <= 0) return 1
    return Math.max(1, raw * 1.15)
  }, [activeSeries])

  const overviewLines = useMemo(
    () =>
      activeSeries.map((s) => {
        const values = s.values.length ? s.values : [0]
        const plotPoints: PlotPoint[] = values.map((value, i) => {
          const x = mapIndexToOverviewX(i, values.length)
          const y =
            TIMELINE_LAYOUT.brush.baselineY -
            (TIMELINE_LAYOUT.brush.plotHeight * value) / overviewMaxY
          return { x, y }
        })
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          plotPoints,
          path: buildSmoothInterpolatedPath(plotPoints, {
            tension: 0.75,
            minY: 0,
            maxY: TIMELINE_LAYOUT.brush.baselineY,
          }),
        }
      }),
    [activeSeries, overviewMaxY],
  )

  const maxPointIndex = Math.max(points.length - 1, 0)

  const brushLeftPercent = percentForIndex(safeZoomStart, maxPointIndex)
  const brushRightPercent = percentForIndex(safeZoomEnd, maxPointIndex)
  const brushWidthPercent = Math.max(brushRightPercent - brushLeftPercent, 0)

  function indexFromClientXWithinBrush(clientX: number) {
    return indexFromClientX(clientX, brushRef.current, maxPointIndex)
  }

  function setZoom(start: number, end: number) {
    const nextStart = clamp(start, 0, maxPointIndex)
    const nextEnd = clamp(end, nextStart, maxPointIndex)
    onZoomStartChange?.(nextStart)
    onZoomEndChange?.(nextEnd)
  }

  function startDrag(mode: DragMode, pointerId: number, clientX: number) {
    dragStateRef.current = {
      mode,
      pointerId,
      originIndex: indexFromClientXWithinBrush(clientX),
      startAtDown: safeZoomStart,
      endAtDown: safeZoomEnd,
    }
  }

  function onBrushPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (points.length === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)

    const clickedIndex = indexFromClientXWithinBrush(e.clientX)
    const distToStart = Math.abs(clickedIndex - safeZoomStart)
    const distToEnd = Math.abs(clickedIndex - safeZoomEnd)

    if (distToStart <= 1 && distToStart <= distToEnd) {
      startDrag('start', e.pointerId, e.clientX)
      return
    }

    if (distToEnd <= 1) {
      startDrag('end', e.pointerId, e.clientX)
      return
    }

    if (clickedIndex >= safeZoomStart && clickedIndex <= safeZoomEnd) {
      startDrag('move', e.pointerId, e.clientX)
    } else {
      const windowSize = Math.max(safeZoomEnd - safeZoomStart, 0)
      const start = Math.min(
        Math.max(clickedIndex - Math.floor(windowSize / 2), 0),
        Math.max(maxPointIndex - windowSize, 0),
      )
      setZoom(start, start + windowSize)
      startDrag('move', e.pointerId, e.clientX)
    }
  }

  function onHandlePointerDown(
    mode: 'start' | 'end',
    e: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!brushRef.current || points.length === 0) return
    brushRef.current.setPointerCapture(e.pointerId)
    startDrag(mode, e.pointerId, e.clientX)
  }

  function onBrushPointerMove(e: globalThis.PointerEvent) {
    const state = dragStateRef.current
    if (!state || e.pointerId !== state.pointerId) return

    const currentIndex = indexFromClientXWithinBrush(e.clientX)
    const delta = currentIndex - state.originIndex

    if (state.mode === 'move') {
      const width = state.endAtDown - state.startAtDown
      let nextStart = state.startAtDown + delta
      nextStart = clamp(nextStart, 0, Math.max(maxPointIndex - width, 0))
      setZoom(nextStart, nextStart + width)
      return
    }

    if (state.mode === 'start') {
      const nextStart = clamp(state.startAtDown + delta, 0, safeZoomEnd)
      setZoom(nextStart, safeZoomEnd)
      return
    }

    const nextEnd = clamp(state.endAtDown + delta, safeZoomStart, maxPointIndex)
    setZoom(safeZoomStart, nextEnd)
  }

  function endDrag(pointerId: number) {
    if (dragStateRef.current?.pointerId === pointerId) {
      dragStateRef.current = null
    }
  }

  const onMouseMove = createRafThrottled((e: MouseEvent) => {
    setHoverFromMouse(e)
  })

  const onBrushPointerMoveThrottled = createRafThrottled((e: PointerEvent) => {
    onBrushPointerMove(e)
  })

  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      onBrushPointerMoveThrottled(e)
    }
    const onWindowPointerUp = (e: PointerEvent) => {
      endDrag(e.pointerId)
    }

    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
    }
  }, [onBrushPointerMoveThrottled, safeZoomEnd, safeZoomStart, maxPointIndex])

  return (
    <div className="dashboard-card">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('timeline.title')}
          </h2>

          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex shrink-0 items-baseline gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('timeline.yAxisMetric')}
              </span>
              <HelpTooltip
                asIcon
                text={t('help.timeline.yAxis')}
                ariaLabel={t('help.aria.timelineYAxis')}
              />
            </div>

            <div className="w-[220px] min-w-[10rem] max-w-full shrink-0">
              <StandardDropdown
                label=""
                options={yAxisOptions}
                modelValue={yAxisMode}
                nullable={false}
                onModelValueChange={(v) =>
                  onYAxisModeChange?.((v as 'entries' | 'exits') ?? 'entries')
                }
              />
            </div>

            <div className="flex min-w-[140px] flex-col text-sm text-gray-500">
              <div className="grid grid-cols-[auto_auto] items-baseline justify-end gap-x-2">
                <span className="shrink-0">{t('common.from')}:</span>
                <span className="tabular-nums">{fromDate}</span>
              </div>
              <div className="grid grid-cols-[auto_auto] items-baseline justify-end gap-x-2">
                <span className="shrink-0">{t('common.to')}:</span>
                <span className="tabular-nums">{toDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[360px] px-4 py-4">
        {error ? (
          <div
            className="flex min-h-[320px] items-center justify-center text-red-600"
            role="alert"
          >
            {t('timeline.loadFailed')}
          </div>
        ) : loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-gray-500">
            <span className="icon-spinner11 inline-block animate-spin text-2xl" />
            <span>{t('timeline.loading')}</span>
          </div>
        ) : !hasLoadedOnce || points.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center text-gray-500">
            {t('timeline.noDataForPeriod')}
          </div>
        ) : (
          <div className="relative min-h-[320px]">
            {refreshing ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                <span className="icon-spinner11 inline-block animate-spin text-3xl text-gray-500" />
              </div>
            ) : null}

            <div className="mb-2 flex items-center gap-1 text-sm text-gray-600">
              <span>{t('timeline.vehicleSeriesFilter')}</span>
              <HelpTooltip
                asIcon
                text={t('help.timeline.series')}
                ariaLabel={t('help.aria.timelineSeries')}
              />
            </div>

            <div className="mb-3 flex flex-wrap gap-3">
              {alignedSeries.map((s) => (
                <label
                  key={s.id}
                  className="series-filter-cb inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={visibleSeries[s.id] !== false}
                    onChange={() => toggleSeries(s.id)}
                  />
                  <span className="cb-box" aria-hidden="true">
                    <svg
                      className="cb-tick"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>

            <div
              ref={chartRef}
              className="relative h-[260px] w-full rounded border border-gray-200 bg-white"
              onMouseLeave={clearHover}
              onMouseMove={onMouseMove}
            >
              <svg
                className="h-full w-full"
                viewBox={`0 0 ${TIMELINE_LAYOUT.main.viewBoxWidth} ${TIMELINE_LAYOUT.main.viewBoxHeight}`}
                preserveAspectRatio="none"
              >
                {mainGridLines.map((grid) => (
                  <line
                    key={`grid-${grid.y}`}
                    x1={TIMELINE_LAYOUT.main.axisLeft}
                    y1={grid.y}
                    x2={
                      TIMELINE_LAYOUT.main.axisLeft + TIMELINE_LAYOUT.main.plotWidth
                    }
                    y2={grid.y}
                    stroke={grid.stroke}
                  />
                ))}

                <line
                  x1={TIMELINE_LAYOUT.main.axisLeft}
                  y1={TIMELINE_LAYOUT.main.axisTop}
                  x2={TIMELINE_LAYOUT.main.axisLeft}
                  y2={TIMELINE_LAYOUT.main.axisBottom}
                  stroke="#d1d5db"
                />

                {mainGridLines.map((grid) => (
                  <text
                    key={`grid-label-${grid.y}`}
                    x={TIMELINE_LAYOUT.main.axisLeft - 6}
                    y={grid.y + 3}
                    textAnchor="end"
                    fontSize={10}
                    fill="#6b7280"
                  >
                    {grid.value}
                  </text>
                ))}

                {xAxisTicks.map((tick) => (
                  <text
                    key={`x-tick-${tick.index}`}
                    x={tick.x}
                    y={TIMELINE_LAYOUT.main.axisBottom + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#6b7280"
                  >
                    {tick.label}
                  </text>
                ))}

                {visibleLines.map((line) => (
                  <path
                    key={line.id}
                    d={line.path}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={1.6}
                    strokeOpacity={0.9}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}

                {hoverIndex != null && hoverX != null ? (
                  <line
                    x1={hoverX}
                    y1={20}
                    x2={hoverX}
                    y2={220}
                    stroke="#9ca3af"
                    strokeDasharray="4 4"
                  />
                ) : null}

                {hoverIndex != null
                  ? visibleLines.map((line) => (
                      <circle
                        key={`hover-${line.id}`}
                        cx={line.plotPoints[hoverIndex]?.x}
                        cy={line.plotPoints[hoverIndex]?.y}
                        r={3.5}
                        fill={line.color}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    ))
                  : null}
              </svg>

              {hoverIndex != null && tooltipRows.length ? (
                <div
                  className="pointer-events-none absolute z-20 rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow"
                  style={{ left: `${tooltipLeft}px`, top: '8px' }}
                >
                  <div className="mb-1 font-semibold text-gray-800">
                    {formatXAxisLabel(visiblePoints[hoverIndex])}
                  </div>
                  {tooltipRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-gray-600">{row.name}:</span>
                      <span className="font-semibold text-gray-900">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-1 text-sm text-gray-700">
                <span>{t('timeline.zoomRange')}</span>
                <HelpTooltip
                  asIcon
                  text={t('help.timeline.zoomRange')}
                  ariaLabel={t('help.aria.timelineZoom')}
                />
              </div>

              <div
                ref={brushRef}
                className="relative h-[88px] w-full cursor-crosshair rounded border border-gray-200 bg-white"
                onPointerDown={onBrushPointerDown}
              >
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${TIMELINE_LAYOUT.brush.viewBoxWidth} ${TIMELINE_LAYOUT.brush.viewBoxHeight}`}
                  preserveAspectRatio="none"
                >
                  <line x1={0} y1={75} x2={1000} y2={75} stroke="#e5e7eb" />
                  {overviewLines.map((line) => (
                    <path
                      key={line.id}
                      d={line.path}
                      fill="none"
                      stroke={line.color}
                      strokeWidth={1.0}
                      strokeOpacity={0.9}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                </svg>

                <div
                  className="absolute inset-y-0 bg-gray-400/25"
                  style={{ left: '0%', width: `${brushLeftPercent}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-gray-400/25"
                  style={{
                    left: `${brushRightPercent}%`,
                    width: `${100 - brushRightPercent}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 border-2 border-emerald-400 bg-emerald-100/40"
                  style={{
                    left: `${brushLeftPercent}%`,
                    width: `${brushWidthPercent}%`,
                  }}
                >
                  <button
                    type="button"
                    aria-label="Resize start"
                    className="absolute inset-y-0 left-0 w-3 -translate-x-1/2 cursor-ew-resize bg-emerald-400/75"
                    onPointerDown={(e) => onHandlePointerDown('start', e)}
                  />
                  <button
                    type="button"
                    aria-label="Resize end"
                    className="absolute inset-y-0 right-0 w-3 translate-x-1/2 cursor-ew-resize"
                    onPointerDown={(e) => onHandlePointerDown('end', e)}
                  />
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                {points[safeZoomStart]} - {points[safeZoomEnd]}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
