/**
 * SEN-224: PDF report content audit.
 *
 * The legacy Menke PDF has 12 embedded charts, an Executive Summary with
 * plan-snapshot metadata, a TOC that lists narrative sections when present,
 * and narrative content blocks from the Report form. This test parses the
 * PDF route source as text and asserts every required piece is wired up.
 *
 * Static-source asserts — the live PDF output itself is tested manually by
 * generating a report against a golden workbook (see SEN-224 comment for
 * the validation workflow).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PDF_ROUTE = readFileSync(
  join(process.cwd(), 'src/app/api/report/pdf/route.ts'),
  'utf-8',
)

describe('SEN-224: PDF report content', () => {
  describe('12 legacy charts', () => {
    const CHARTS = [
      'roBarChart',            // purchase_chart
      'shareTurnoverBar',      // shareTurnover_chart
      'detailedTurnoverChart', // details_chart
      'driversPie',            // piechart
      'valuationBar',          // esop_valuation_chart
      'priceBar',              // share_price_chart
      'successChart',          // success_chart
      'benefitChart',          // benefit_chart
      'stockAllocationChart',  // stock_chart
      'termedPie',             // termination_chart
      'termedSharesChart',     // termination_shares_chart
      'benefitBenchmark',      // benefit_benchmark_chart
    ] as const

    it.each(CHARTS)('defines %s', (chartName) => {
      expect(PDF_ROUTE).toMatch(new RegExp(`const\\s+${chartName}\\s*=`))
    })

    it.each(CHARTS)('embeds %s in the output HTML', (chartName) => {
      // Each chart is inserted via a ${chartName} template literal at least once
      expect(PDF_ROUTE).toContain(`\${${chartName}}`)
    })

    it('imports SVG chart renderers from the shared library', () => {
      expect(PDF_ROUTE).toContain("from '@/lib/report/svg-charts'")
      expect(PDF_ROUTE).toContain('renderLineChart')
      expect(PDF_ROUTE).toContain('renderBarChart')
      expect(PDF_ROUTE).toContain('renderPieChart')
      expect(PDF_ROUTE).toContain('renderStackedBarChart')
    })
  })

  describe('narrative rendering', () => {
    it('calls renderNarrativeSections with data.narrative', () => {
      expect(PDF_ROUTE).toContain('renderNarrativeSections(data.narrative)')
    })

    it('defines hasAnyNarrative helper for TOC gating', () => {
      expect(PDF_ROUTE).toContain('function hasAnyNarrative')
    })

    it('TOC conditionally lists Plan Narrative sub-sections', () => {
      expect(PDF_ROUTE).toContain('hasAnyNarrative(data.narrative)')
      expect(PDF_ROUTE).toContain('Plan Narrative')
      expect(PDF_ROUTE).toContain('Plan Structure')
      expect(PDF_ROUTE).toContain('Redemption &amp; Recycling')
    })
  })

  describe('plan snapshot metadata', () => {
    it('renders Plan Stage in Executive Summary when provided', () => {
      expect(PDF_ROUTE).toContain('data.planStage')
      // Inside the EXECUTIVE SUMMARY page
      const execIdx = PDF_ROUTE.indexOf('EXECUTIVE SUMMARY')
      const planStageIdx = PDF_ROUTE.indexOf('data.planStage')
      expect(planStageIdx).toBeGreaterThan(execIdx)
    })

    it('renders Funding Approach in Executive Summary when provided', () => {
      expect(PDF_ROUTE).toContain('data.fundingApproach')
    })

    it('renders Contribution Source in Executive Summary when provided', () => {
      expect(PDF_ROUTE).toContain('data.contributionSource')
    })
  })
})
