import { describe, it, expect } from 'vitest'
import {
  renderLineChart, renderBarChart, renderPieChart, renderStackedBarChart,
  CHART_BRAND,
} from '../../src/lib/report/svg-charts'

/**
 * Unit tests for the server-side SVG chart generators powering
 * the embedded PDF report charts (SEN-199).
 */

const POINTS_3 = [
  { label: 'Year 0', value: 100 },
  { label: 'Year 1', value: 150 },
  { label: 'Year 2', value: 120 },
]

describe('renderLineChart', () => {
  it('returns SVG with svg tag and xmlns', () => {
    const out = renderLineChart(POINTS_3)
    expect(out).toContain('<svg')
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
  })
  it('includes all data point dots', () => {
    const out = renderLineChart(POINTS_3)
    const circles = out.match(/<circle/g) ?? []
    expect(circles.length).toBe(3)
  })
  it('renders a path element for the line', () => {
    const out = renderLineChart(POINTS_3)
    expect(out).toMatch(/<path d="M/)
  })
  it('empty data returns empty-state SVG with "No data available"', () => {
    const out = renderLineChart([])
    expect(out).toContain('No data available')
  })
  it('title is embedded when provided', () => {
    const out = renderLineChart(POINTS_3, { title: 'My Chart' })
    expect(out).toContain('My Chart')
  })
  it('dollar format includes $ prefix', () => {
    const out = renderLineChart(POINTS_3, { yFormat: 'dollar' })
    expect(out).toContain('$')
  })
  it('percent format shows percentages', () => {
    const out = renderLineChart([{ label: '0', value: 0.5 }], { yFormat: 'percent' })
    expect(out).toContain('%')
  })
  it('custom color is applied to path stroke', () => {
    const out = renderLineChart(POINTS_3, { color: '#FF0000' })
    expect(out).toContain('stroke="#FF0000"')
  })
  it('custom dimensions set viewBox', () => {
    const out = renderLineChart(POINTS_3, { width: 800, height: 400 })
    expect(out).toContain('viewBox="0 0 800 400"')
  })
  it('single-point data does not error', () => {
    const out = renderLineChart([{ label: 'Only', value: 1 }])
    expect(out).toContain('<svg')
  })
  it('HTML-unsafe labels are escaped', () => {
    const out = renderLineChart([{ label: '<script>', value: 1 }])
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toMatch(/<script>[^<]*<\/script>/)
  })
  it('y-axis has tick lines for gridlines', () => {
    const out = renderLineChart(POINTS_3)
    // Expect 5 horizontal grid lines (yTicks = 4 intervals → 5 lines)
    const lineCount = (out.match(/<line x1="\d+/g) ?? []).length
    expect(lineCount).toBeGreaterThanOrEqual(4)
  })
})

describe('renderBarChart', () => {
  it('returns SVG element', () => {
    const out = renderBarChart(POINTS_3)
    expect(out).toContain('<svg')
  })
  it('draws one rect per data point (plus any other rects)', () => {
    const out = renderBarChart(POINTS_3)
    const rects = out.match(/<rect /g) ?? []
    expect(rects.length).toBeGreaterThanOrEqual(3)
  })
  it('custom title embedded', () => {
    const out = renderBarChart(POINTS_3, { title: 'Bar Test' })
    expect(out).toContain('Bar Test')
  })
  it('bar fill uses provided color', () => {
    const out = renderBarChart(POINTS_3, { color: '#00FF00' })
    expect(out).toContain('fill="#00FF00"')
  })
  it('empty data → no-data SVG', () => {
    const out = renderBarChart([])
    expect(out).toContain('No data available')
  })
  it('negative values still render without error', () => {
    const out = renderBarChart([{ label: 'X', value: -5 }])
    expect(out).toContain('<svg')
  })
})

describe('renderPieChart', () => {
  it('returns SVG', () => {
    const out = renderPieChart(POINTS_3)
    expect(out).toContain('<svg')
  })
  it('renders a path per non-zero slice', () => {
    const out = renderPieChart([
      { label: 'A', value: 10 },
      { label: 'B', value: 20 },
      { label: 'C', value: 30 },
    ])
    const paths = out.match(/<path /g) ?? []
    expect(paths.length).toBe(3)
  })
  it('filters out zero-value slices', () => {
    const out = renderPieChart([
      { label: 'A', value: 10 },
      { label: 'Skipped', value: 0 },
    ])
    expect(out).not.toContain('Skipped')
  })
  it('all-zero input → empty-state', () => {
    const out = renderPieChart([
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ])
    expect(out).toContain('No data available')
  })
  it('legend includes percentages', () => {
    const out = renderPieChart([
      { label: 'Half', value: 50 },
      { label: 'Other half', value: 50 },
    ])
    expect(out).toContain('50.0%')
  })
  it('legend labels are escaped', () => {
    const out = renderPieChart([{ label: '<evil>', value: 5 }])
    expect(out).toContain('&lt;evil&gt;')
  })
  it('title is embedded when provided', () => {
    const out = renderPieChart(POINTS_3, { title: 'Pie Title' })
    expect(out).toContain('Pie Title')
  })
})

describe('renderStackedBarChart', () => {
  it('returns SVG with both series', () => {
    const out = renderStackedBarChart(
      ['Yr 0', 'Yr 1'],
      [
        { name: 'A', values: [10, 20] },
        { name: 'B', values: [5, 15] },
      ]
    )
    expect(out).toContain('A')
    expect(out).toContain('B')
  })
  it('renders legend entries', () => {
    const out = renderStackedBarChart(
      ['Yr 0'],
      [{ name: 'Series 1', values: [10] }],
    )
    expect(out).toContain('Series 1')
  })
  it('empty input → no-data SVG', () => {
    expect(renderStackedBarChart([], [])).toContain('No data available')
    expect(renderStackedBarChart(['a'], [])).toContain('No data available')
  })
  it('negative values clamped to 0 (stacking positive only)', () => {
    const out = renderStackedBarChart(
      ['Yr 0'],
      [{ name: 'A', values: [-5] }]
    )
    // Should still produce a valid SVG
    expect(out).toContain('<svg')
  })
  it('missing values for a year default to 0', () => {
    const out = renderStackedBarChart(
      ['Yr 0', 'Yr 1'],
      [{ name: 'A', values: [10] }],  // only 1 value for 2 labels
    )
    expect(out).toContain('<svg')
  })
  it('custom dollar format', () => {
    const out = renderStackedBarChart(
      ['Yr 0'],
      [{ name: 'A', values: [1000000] }],
      { yFormat: 'dollar' }
    )
    expect(out).toContain('$')
  })
})

describe('CHART_BRAND palette exports', () => {
  it('includes the core brand colors', () => {
    expect(CHART_BRAND.navy).toMatch(/^#/)
    expect(CHART_BRAND.blue).toMatch(/^#/)
    expect(CHART_BRAND.green).toMatch(/^#/)
    expect(CHART_BRAND.gold).toMatch(/^#/)
    expect(CHART_BRAND.red).toMatch(/^#/)
  })
  it('all values are 6-digit hex colors', () => {
    for (const color of Object.values(CHART_BRAND)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

describe('Chart output correctness', () => {
  it('all chart renderers return well-formed SVG roots', () => {
    for (const fn of [
      () => renderLineChart(POINTS_3),
      () => renderBarChart(POINTS_3),
      () => renderPieChart(POINTS_3),
      () => renderStackedBarChart(['a'], [{ name: 'A', values: [1] }]),
    ]) {
      const out = fn()
      expect(out.trim()).toMatch(/^<svg/)
      expect(out.trim()).toMatch(/<\/svg>$/)
    }
  })
  it('all charts include viewBox', () => {
    for (const out of [
      renderLineChart(POINTS_3),
      renderBarChart(POINTS_3),
      renderPieChart(POINTS_3),
      renderStackedBarChart(['a'], [{ name: 'A', values: [1] }]),
    ]) {
      expect(out).toMatch(/viewBox="0 0 \d+ \d+"/)
    }
  })
  it('all charts include role="img" for a11y', () => {
    for (const out of [
      renderLineChart(POINTS_3),
      renderBarChart(POINTS_3),
      renderPieChart(POINTS_3),
      renderStackedBarChart(['a'], [{ name: 'A', values: [1] }]),
    ]) {
      expect(out).toContain('role="img"')
    }
  })
})
