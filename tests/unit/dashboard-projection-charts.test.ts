/**
 * SEN-227: Dashboard Projection Charts section.
 *
 * Legacy `Views/index/Index.cshtml` pairs each Low/High/Average tile with an
 * inline trend chart. The prior Next.js dashboard had the tiles but not the
 * charts. This suite confirms the `/dashboard` page source includes all three
 * expected chart cards and binds them to the right Supabase columns.
 *
 * Static-source asserts only — no DB, no render — so the test is deterministic
 * and will flag any future regression that removes a chart or rebinds it to
 * the wrong field.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx'),
  'utf-8',
)

describe('SEN-227: dashboard projection charts', () => {
  it('imports AppLineChart for inline trend charts', () => {
    expect(SOURCE).toContain("from '@/components/charts/line-chart'")
    expect(SOURCE).toContain('AppLineChart')
  })

  it('renders a Projection Charts section', () => {
    expect(SOURCE).toMatch(/Projection Charts/)
    expect(SOURCE).toMatch(/aria-label="Projection Charts"/)
  })

  it('renders the Repurchase Obligation Projection chart bound to total_repurchase_obligation', () => {
    expect(SOURCE).toContain('Repurchase Obligation Projection')
    expect(SOURCE).toContain('r.total_repurchase_obligation')
    expect(SOURCE).toContain("formatType=\"dollarM\"")
  })

  it('renders the Valuation Share Price Change chart bound to share_price_change', () => {
    expect(SOURCE).toContain('Valuation — Share Price Change')
    expect(SOURCE).toContain('v.share_price_change')
  })

  it('renders the ESOP Success Score Projection chart bound to esop_success_score', () => {
    expect(SOURCE).toContain('ESOP Success Score Projection')
    expect(SOURCE).toContain('s.esop_success_score')
  })

  it('keeps the Low/High/Average Executive Summary Highlights section', () => {
    expect(SOURCE).toContain('Executive Summary Highlights')
    expect(SOURCE).toContain('Low')
    expect(SOURCE).toContain('High')
    expect(SOURCE).toContain('Average')
  })
})
