import type { ChangeEvent, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TIMELINE_LAYOUT,
  createRafThrottled,
  type TimelineSeries,
} from '../../composables/timelineChart.utils'
import useTimelineMainChartState from '../../composables/useTimelineMainChartState'
import { StandardDropdown } from '../ui/StandardDropdown'

export type TimelineVehicleTypeChartProps = {
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

export function TimelineVehicleTypeChart({
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
}: TimelineVehicleTypeChartProps) {
  const { t } = useTranslation()

  const {
    chartRef,
    yAxisOptions,
    visibleSeries,
    alignedSeries,
    safeZoomStart,
    safeZoomEnd,
    visiblePoints,
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
  })

  function onStartInput(e: ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value)
    onZoomStartChange?.(Math.min(value, safeZoomEnd))
  }

  function onEndInput(e: ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value)
    onZoomEndChange?.(Math.max(value, safeZoomStart))
  }

  const onMouseMoveThrottled = createRafThrottled((e: MouseEvent) => {
    setHoverFromMouse(e)
  })

  return (
    <div className="dashboard-card">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('timeline.title')}
          </h2>

          <div className="flex items-center gap-3">
            <div className="w-[220px]">
              <StandardDropdown
                label={t('timeline.yAxisMetric')}
                options={yAxisOptions}
                modelValue={yAxisMode}
                nullable={false}
                onModelValueChange={(v) =>
                  onYAxisModeChange?.((v as 'entries' | 'exits') ?? 'entries')
                }
              />
            </div>

            <div className="text-sm text-gray-500">
              {fromDate} - {toDate}
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

            <div className="mb-3 flex flex-wrap gap-3">
              {alignedSeries.map((s) => (
                <label
                  key={s.id}
                  className="inline-flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={visibleSeries[s.id] !== false}
                    onChange={() => toggleSeries(s.id)}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
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
              onMouseMove={onMouseMoveThrottled}
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
                    x2={TIMELINE_LAYOUT.main.axisLeft + TIMELINE_LAYOUT.main.plotWidth}
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
                    strokeWidth={3}
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
                        r={4.5}
                        fill={line.color}
                        stroke="white"
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

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                {t('timeline.zoomStartDay')}
                <input
                  type="range"
                  min={0}
                  max={Math.max(points.length - 1, 0)}
                  value={safeZoomStart}
                  className="w-full"
                  onChange={onStartInput}
                />
              </label>
              <label className="text-sm text-gray-700">
                {t('timeline.zoomEndDay')}
                <input
                  type="range"
                  min={0}
                  max={Math.max(points.length - 1, 0)}
                  value={safeZoomEnd}
                  className="w-full"
                  onChange={onEndInput}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
