import { useCallback, useMemo, useRef, useState } from 'react'
import {
  TIMELINE_LAYOUT,
  alignSeriesToPointCount,
  buildSmoothInterpolatedPath,
  clamp,
  mapIndexToMainChartX,
  maxFromRange,
  type PlotPoint,
  type TimelineSeries,
} from './timelineChart.utils'

function useTimelineMainChartState(params: {
  points: string[]
  series: TimelineSeries[]
  zoomStart: number
  zoomEnd: number
  t: (key: string) => string
  gridSecondaryStroke?: string
}) {
  const { points, series, zoomStart, zoomEnd, t, gridSecondaryStroke = '#f1f5f9' } = params
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({})

  const alignedSeries = useMemo(
    () => alignSeriesToPointCount(series, points.length),
    [series, points.length],
  )

  const yAxisOptions = useMemo(
    () => [
      { id: 'entries', label: t('timeline.entriesPerDay') },
      { id: 'exits', label: t('timeline.exitsPerDay') },
    ],
    [t],
  )

  const safeZoomStart = Math.min(Math.max(zoomStart, 0), Math.max(points.length - 1, 0))
  const safeZoomEnd = Math.min(
    Math.max(zoomEnd, safeZoomStart),
    Math.max(points.length - 1, 0),
  )

  const visiblePoints = points.slice(safeZoomStart, safeZoomEnd + 1)
  const activeSeries = alignedSeries.filter((s) => visibleSeries[s.id] !== false)
  const rawMaxY = maxFromRange(activeSeries, safeZoomStart, safeZoomEnd)
  const maxY = rawMaxY <= 0 ? 1 : Math.max(1, rawMaxY * 1.15)

  const mainGridLines = useMemo(() => {
    const count = 5
    const span = TIMELINE_LAYOUT.main.axisBottom - TIMELINE_LAYOUT.main.axisTop
    return Array.from({ length: count }, (_, index) => {
      const ratio = index / (count - 1)
      const y = TIMELINE_LAYOUT.main.axisBottom - ratio * span
      const value = Math.round(ratio * maxY)
      return { y, value, stroke: index === 0 ? '#d1d5db' : gridSecondaryStroke }
    })
  }, [maxY, gridSecondaryStroke])

  const formatXAxisLabel = (value: string) => value || '–'

  const xAxisTicks = useMemo(() => {
    const count = visiblePoints.length
    if (count === 0) return []
    const targetTicks = 8
    const step = Math.max(1, Math.floor((count - 1) / Math.max(targetTicks - 1, 1)))
    const ticks: Array<{ index: number; x: number; label: string }> = []
    for (let index = 0; index < count; index += step) {
      ticks.push({
        index,
        x: mapIndexToMainChartX(index, count),
        label: formatXAxisLabel(visiblePoints[index]),
      })
    }
    if (ticks[ticks.length - 1]?.index !== count - 1) {
      ticks.push({
        index: count - 1,
        x: mapIndexToMainChartX(count - 1, count),
        label: formatXAxisLabel(visiblePoints[count - 1]),
      })
    }
    return ticks
  }, [visiblePoints])

  const visibleLines = activeSeries.map((s) => {
    const values = s.values.slice(safeZoomStart, safeZoomEnd + 1)
    const plotPoints: PlotPoint[] = values.map((value, i) => {
      const x = mapIndexToMainChartX(i, visiblePoints.length)
      const y =
        TIMELINE_LAYOUT.main.axisBottom -
        (TIMELINE_LAYOUT.main.plotHeight * value) / maxY
      return { x, y }
    })
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      plotPoints,
      path: buildSmoothInterpolatedPath(plotPoints, {
        tension: 0.75,
        minY: TIMELINE_LAYOUT.main.axisTop,
        maxY: TIMELINE_LAYOUT.main.axisBottom,
      }),
    }
  })

  const tooltipRows =
    hoverIndex == null
      ? []
      : activeSeries.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          value: s.values[safeZoomStart + hoverIndex] ?? 0,
        }))

  const tooltipLeft = useMemo(() => {
    if (hoverX == null || !chartRef.current) return TIMELINE_LAYOUT.main.tooltipOffset
    const chartWidth = chartRef.current.clientWidth
    const leftPx =
      (hoverX / TIMELINE_LAYOUT.main.viewBoxWidth) * chartWidth +
      TIMELINE_LAYOUT.main.tooltipOffset
    return Math.min(
      Math.max(leftPx, TIMELINE_LAYOUT.main.tooltipOffset),
      Math.max(
        chartWidth -
          TIMELINE_LAYOUT.main.tooltipEstimatedWidth -
          TIMELINE_LAYOUT.main.tooltipOffset,
        TIMELINE_LAYOUT.main.tooltipOffset,
      ),
    )
  }, [hoverX])

  const toggleSeries = useCallback((id: string) => {
    setVisibleSeries((prev) => {
      const current = prev[id] !== false
      return { ...prev, [id]: !current }
    })
  }, [])

  const clearHover = useCallback(() => {
    setHoverIndex(null)
    setHoverX(null)
  }, [])

  const setHoverFromMouse = useCallback(
    (e: React.MouseEvent) => {
      if (!chartRef.current || visiblePoints.length === 0) return
      const rect = chartRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const clampedX = clamp(x, 0, rect.width)
      const ratio = rect.width > 0 ? clampedX / rect.width : 0
      const idx = Math.round(ratio * (visiblePoints.length - 1))
      const normalizedIndex = clamp(idx, 0, visiblePoints.length - 1)
      setHoverIndex(normalizedIndex)
      setHoverX(mapIndexToMainChartX(normalizedIndex, visiblePoints.length))
    },
    [visiblePoints.length],
  )

  return {
    chartRef,
    yAxisOptions,
    visibleSeries,
    alignedSeries,
    safeZoomStart,
    safeZoomEnd,
    visiblePoints,
    activeSeries,
    maxY,
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
  }
}

export default useTimelineMainChartState
