/**
 * Zero-dependency SVG chart generators for inline embedding in the
 * PDF-ready HTML report. Each function returns a complete `<svg>`
 * string sized to the provided width/height.
 *
 * Covers the chart types referenced by the legacy ReportModel.cs:
 *   - Line  (esop_valuation_chart, share_price_chart, success_chart,
 *            purchase_chart, benefit_chart, benefit_benchmark_chart)
 *   - Bar   (shareTurnover_chart, stock_chart, termination_chart,
 *            termination_shares_chart)
 *   - Pie   (piechart, details_chart)
 */

export const CHART_BRAND = {
  navy: '#1E3A8A',
  navyLight: '#2C3E6B',
  blue: '#3B82F6',
  teal: '#0EA5E9',
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  gold: '#D4A843',
  purple: '#8B5CF6',
  muted: '#94A3B8',
} as const

const PALETTE = [
  CHART_BRAND.navy, CHART_BRAND.blue, CHART_BRAND.teal, CHART_BRAND.green,
  CHART_BRAND.orange, CHART_BRAND.purple, CHART_BRAND.gold, CHART_BRAND.red,
]

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function niceNumber(n: number): string {
  if (!isFinite(n)) return '0'
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  if (Math.abs(n) >= 1) return n.toFixed(0)
  return n.toFixed(2)
}

interface Point {
  label: string
  value: number
}

interface LineChartOpts {
  width?: number
  height?: number
  color?: string
  title?: string
  yFormat?: 'dollar' | 'percent' | 'number'
}

/** Single-series line chart */
export function renderLineChart(
  data: Point[],
  { width = 640, height = 260, color = CHART_BRAND.navy, title, yFormat = 'number' }: LineChartOpts = {}
): string {
  if (data.length === 0) return emptyChart(width, height, title)

  const padding = { top: title ? 36 : 20, right: 20, bottom: 40, left: 70 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = data.map(d => d.value)
  const maxV = Math.max(...values, 0)
  const minV = Math.min(...values, 0)
  const range = maxV - minV || 1

  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW / 2
  const points = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? i * xStep : innerW / 2)
    const y = padding.top + innerH - ((d.value - minV) / range) * innerH
    return { x, y, label: d.label, value: d.value }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const yTicks = 4
  const yLines: string[] = []
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + (range * i) / yTicks
    const y = padding.top + innerH - (i / yTicks) * innerH
    yLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>`)
    yLines.push(`<text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#6B7280" text-anchor="end" font-family="sans-serif">${formatY(v, yFormat)}</text>`)
  }

  const xLabels = points.map((p) =>
    `<text x="${p.x}" y="${height - padding.bottom + 14}" font-size="9" fill="#6B7280" text-anchor="middle" font-family="sans-serif">${escapeText(p.label)}</text>`
  ).join('')

  const dots = points.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}"/>`
  ).join('')

  const titleEl = title
    ? `<text x="${width / 2}" y="20" font-size="13" fill="${CHART_BRAND.navy}" text-anchor="middle" font-weight="600" font-family="sans-serif">${escapeText(title)}</text>`
    : ''

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" style="max-width:100%;height:auto">
    ${titleEl}
    ${yLines.join('')}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
    ${dots}
    ${xLabels}
  </svg>`
}

interface BarChartOpts extends LineChartOpts {
  stacked?: boolean
}

/** Vertical bar chart (single series) */
export function renderBarChart(
  data: Point[],
  { width = 640, height = 260, color = CHART_BRAND.blue, title, yFormat = 'number' }: BarChartOpts = {}
): string {
  if (data.length === 0) return emptyChart(width, height, title)

  const padding = { top: title ? 36 : 20, right: 20, bottom: 40, left: 70 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const maxV = Math.max(...data.map(d => d.value), 0)

  const barWidth = (innerW / data.length) * 0.7
  const barGap = (innerW / data.length) * 0.3

  const bars = data.map((d, i) => {
    const h = maxV > 0 ? (d.value / maxV) * innerH : 0
    const x = padding.left + i * (barWidth + barGap) + barGap / 2
    const y = padding.top + innerH - h
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="2"/>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - padding.bottom + 14}" font-size="9" fill="#6B7280" text-anchor="middle" font-family="sans-serif">${escapeText(d.label)}</text>
    `
  }).join('')

  const yTicks = 4
  const yLines: string[] = []
  for (let i = 0; i <= yTicks; i++) {
    const v = (maxV * i) / yTicks
    const y = padding.top + innerH - (i / yTicks) * innerH
    yLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>`)
    yLines.push(`<text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#6B7280" text-anchor="end" font-family="sans-serif">${formatY(v, yFormat)}</text>`)
  }

  const titleEl = title
    ? `<text x="${width / 2}" y="20" font-size="13" fill="${CHART_BRAND.navy}" text-anchor="middle" font-weight="600" font-family="sans-serif">${escapeText(title)}</text>`
    : ''

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" style="max-width:100%;height:auto">
    ${titleEl}
    ${yLines.join('')}
    ${bars}
  </svg>`
}

interface PieChartOpts {
  width?: number
  height?: number
  title?: string
}

/** Pie chart */
export function renderPieChart(
  data: Point[],
  { width = 360, height = 280, title }: PieChartOpts = {}
): string {
  const filtered = data.filter(d => d.value > 0)
  if (filtered.length === 0) return emptyChart(width, height, title)

  const titleH = title ? 30 : 0
  const cx = width * 0.35
  const cy = titleH + (height - titleH) / 2
  const r = Math.min(cx, (height - titleH) / 2) - 8

  const total = filtered.reduce((s, d) => s + d.value, 0)
  let angleStart = -Math.PI / 2

  const slices = filtered.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angleStart)
    const y1 = cy + r * Math.sin(angleStart)
    const x2 = cx + r * Math.cos(angleStart + angle)
    const y2 = cy + r * Math.sin(angleStart + angle)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`
    angleStart += angle
    return { path, color: PALETTE[i % PALETTE.length]!, d }
  })

  const legendX = width * 0.72
  const legendY = titleH + 20
  const legend = slices.map((s, i) => {
    const y = legendY + i * 18
    const pct = ((s.d.value / total) * 100).toFixed(1)
    return `
      <rect x="${legendX}" y="${y - 9}" width="10" height="10" fill="${s.color}" rx="1"/>
      <text x="${legendX + 16}" y="${y}" font-size="10" fill="#334155" font-family="sans-serif">${escapeText(s.d.label)} (${pct}%)</text>
    `
  }).join('')

  const sliceEls = slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="1"/>`).join('')

  const titleEl = title
    ? `<text x="${width / 2}" y="20" font-size="13" fill="${CHART_BRAND.navy}" text-anchor="middle" font-weight="600" font-family="sans-serif">${escapeText(title)}</text>`
    : ''

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" style="max-width:100%;height:auto">
    ${titleEl}
    ${sliceEls}
    ${legend}
  </svg>`
}

/** Stacked bar chart for multi-series data */
export function renderStackedBarChart(
  labels: string[],
  series: Array<{ name: string; values: number[]; color?: string }>,
  { width = 640, height = 280, title, yFormat = 'number' }: { width?: number; height?: number; title?: string; yFormat?: 'dollar' | 'percent' | 'number' } = {}
): string {
  if (labels.length === 0 || series.length === 0) return emptyChart(width, height, title)

  const padding = { top: title ? 36 : 20, right: 140, bottom: 40, left: 70 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const totals = labels.map((_, i) =>
    series.reduce((s, ser) => s + Math.max(0, ser.values[i] ?? 0), 0)
  )
  const maxV = Math.max(...totals, 0)

  const barWidth = (innerW / labels.length) * 0.7
  const barGap = (innerW / labels.length) * 0.3

  const bars = labels.map((_, i) => {
    const x = padding.left + i * (barWidth + barGap) + barGap / 2
    let yCursor = padding.top + innerH
    const segments = series.map((ser, si) => {
      const v = Math.max(0, ser.values[i] ?? 0)
      const h = maxV > 0 ? (v / maxV) * innerH : 0
      yCursor -= h
      const color = ser.color ?? PALETTE[si % PALETTE.length]
      return `<rect x="${x.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}"/>`
    }).join('')
    const labelEl = `<text x="${(x + barWidth / 2).toFixed(1)}" y="${height - padding.bottom + 14}" font-size="9" fill="#6B7280" text-anchor="middle" font-family="sans-serif">${escapeText(labels[i]!)}</text>`
    return segments + labelEl
  }).join('')

  const yTicks = 4
  const yLines: string[] = []
  for (let i = 0; i <= yTicks; i++) {
    const v = (maxV * i) / yTicks
    const y = padding.top + innerH - (i / yTicks) * innerH
    yLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>`)
    yLines.push(`<text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#6B7280" text-anchor="end" font-family="sans-serif">${formatY(v, yFormat)}</text>`)
  }

  const legendX = width - padding.right + 10
  const legend = series.map((ser, i) => {
    const color = ser.color ?? PALETTE[i % PALETTE.length]
    const y = padding.top + 12 + i * 18
    return `
      <rect x="${legendX}" y="${y - 9}" width="10" height="10" fill="${color}" rx="1"/>
      <text x="${legendX + 16}" y="${y}" font-size="10" fill="#334155" font-family="sans-serif">${escapeText(ser.name)}</text>
    `
  }).join('')

  const titleEl = title
    ? `<text x="${(padding.left + innerW / 2).toFixed(1)}" y="20" font-size="13" fill="${CHART_BRAND.navy}" text-anchor="middle" font-weight="600" font-family="sans-serif">${escapeText(title)}</text>`
    : ''

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" style="max-width:100%;height:auto">
    ${titleEl}
    ${yLines.join('')}
    ${bars}
    ${legend}
  </svg>`
}

function emptyChart(w: number, h: number, title?: string): string {
  const titleEl = title
    ? `<text x="${w / 2}" y="20" font-size="13" fill="${CHART_BRAND.navy}" text-anchor="middle" font-weight="600" font-family="sans-serif">${escapeText(title)}</text>`
    : ''
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" style="max-width:100%;height:auto">
    ${titleEl}
    <rect x="0" y="0" width="${w}" height="${h}" fill="#F9FAFB" stroke="#E5E7EB"/>
    <text x="${w / 2}" y="${h / 2}" font-size="12" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">No data available</text>
  </svg>`
}

function formatY(v: number, format: 'dollar' | 'percent' | 'number'): string {
  if (format === 'dollar') return `$${niceNumber(v)}`
  if (format === 'percent') return `${(v * 100).toFixed(1)}%`
  return niceNumber(v)
}
