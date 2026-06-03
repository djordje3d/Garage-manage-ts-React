export type TimelineSeries = {
  id?: string
  name: string
  values: number[]
  color: string
}

export type AlignedTimelineSeries = {
  id: string
  name: string
  values: number[]
  color: string
}

export type PlotPoint = { x: number; y: number }

export const TIMELINE_LAYOUT = {
  main: {
    viewBoxWidth: 1000,
    viewBoxHeight: 260,
    axisLeft: 40,
    axisTop: 20,
    axisBottom: 220,
    plotWidth: 940,
    plotHeight: 200,
    tooltipOffset: 12,
    tooltipEstimatedWidth: 180,
  },
  brush: {
    viewBoxWidth: 1000,
    viewBoxHeight: 88,
    baselineY: 75,
    plotHeight: 63,
  },
} as const

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function percentForIndex(index: number, maxIndex: number): number {
  if (maxIndex <= 0) return 0
  return (index / maxIndex) * 100
}

export function indexFromClientX(
  clientX: number,
  element: HTMLElement | null,
  maxIndex: number,
): number {
  if (!element || maxIndex <= 0) return 0
  const rect = element.getBoundingClientRect()
  const x = clamp(clientX - rect.left, 0, rect.width)
  const ratio = rect.width > 0 ? x / rect.width : 0
  return Math.round(ratio * maxIndex)
}

export function mapIndexToMainChartX(index: number, pointCount: number): number {
  if (pointCount <= 1) return TIMELINE_LAYOUT.main.axisLeft
  return (
    TIMELINE_LAYOUT.main.axisLeft +
    (TIMELINE_LAYOUT.main.plotWidth * index) / (pointCount - 1)
  )
}

export function mapIndexToOverviewX(index: number, pointCount: number): number {
  if (pointCount <= 1) return 0
  return (TIMELINE_LAYOUT.brush.viewBoxWidth * index) / (pointCount - 1)
}

export function alignSeriesToPointCount(
  series: TimelineSeries[],
  pointCount: number,
): AlignedTimelineSeries[] {
  return series.map((item, index) => {
    const stableId = item.id ?? `${item.name}__${item.color}__${index}`
    const alignedValues =
      item.values.length >= pointCount
        ? item.values.slice(0, pointCount)
        : [...item.values, ...Array.from({ length: pointCount - item.values.length }, () => 0)]
    return { id: stableId, name: item.name, color: item.color, values: alignedValues }
  })
}

export function maxFromRange(
  series: AlignedTimelineSeries[],
  start: number,
  end: number,
): number {
  let max = 0
  for (const item of series) {
    const slice = item.values.slice(start, end + 1)
    for (const value of slice) {
      if (value > max) max = value
    }
  }
  return max === 0 ? 1 : max
}

export function maxFromAll(series: AlignedTimelineSeries[]): number {
  let max = 0
  for (const item of series) {
    for (const value of item.values) {
      if (value > max) max = value
    }
  }
  return max === 0 ? 1 : max
}

export function buildSmoothInterpolatedPath(
  points: PlotPoint[],
  options?: { tension?: number; minY?: number; maxY?: number },
): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  const tension = options?.tension ?? 0.75
  const minY = options?.minY ?? Number.NEGATIVE_INFINITY
  const maxY = options?.maxY ?? Number.POSITIVE_INFINITY
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    let cp1x = p1.x + ((p2.x - p0.x) / 6) * tension
    let cp1y = p1.y + ((p2.y - p0.y) / 6) * tension
    let cp2x = p2.x - ((p3.x - p1.x) / 6) * tension
    let cp2y = p2.y - ((p3.y - p1.y) / 6) * tension
    cp1x = clamp(cp1x, p1.x, p2.x)
    cp2x = clamp(cp2x, p1.x, p2.x)
    cp1y = clamp(cp1y, minY, maxY)
    cp2y = clamp(cp2y, minY, maxY)
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

export function createRafThrottled<T extends (...args: never[]) => void>(fn: T): T {
  let rafId: number | null = null
  let lastArgs: Parameters<T> | null = null
  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args
    if (rafId != null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      if (!lastArgs) return
      fn(...lastArgs)
      lastArgs = null
    })
  }) as T
  return throttled
}
