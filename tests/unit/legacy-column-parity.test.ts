/**
 * SEN-226: Legacy column parity for analytical pages.
 *
 * The legacy asmitastagingdb Razor views (`Views/RepurchaseObligation/Index.cshtml`,
 * `Views/RepurchaseObligation/ShareTurnoverSchedule.cshtml`,
 * `Views/PopulationAnalysis/Index.cshtml`, `Views/index/Valuation.cshtml`) define
 * a specific column order that users have internalised. The current Next.js
 * analytical pages must render these same columns in the same order so the
 * tables are visually identical.
 *
 * This suite parses each page.tsx source as text and asserts the `<th>`
 * headers appear in legacy order — no DB or rendering involved, pure
 * regression guard against a future dev deleting/reordering a column.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

function extractHeaders(source: string): string[] {
  // Match <th ...>...</th>, capture trimmed inner text, normalise whitespace.
  // Use `<th(?=[\s>])` lookahead so we don't accidentally eat `<thead>` as well.
  const headers: string[] = []
  const re = /<th(?=[\s>])[^>]*>([\s\S]*?)<\/th>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const inner = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    headers.push(inner.replace(/\s+/g, ' ').trim())
  }
  return headers
}

describe('SEN-226: legacy column parity', () => {
  describe('/repurchase — Repurchase Obligation', () => {
    const source = readPage('src/app/(dashboard)/repurchase/page.tsx')
    const headers = extractHeaders(source)

    it('renders all 14 legacy columns in order', () => {
      const expected = [
        'Plan Year',
        'Calendar Year for Payout',
        'Share Price',
        'ESOP Shares Allocated',
        'Shares Turned',
        'OIA Balance',
        'Total ESOP Assets',
        'ESOP Shares Redeemed',
        'Diversification',
        'In-Service Distributions',
        'Retirement/Death/Disability',
        'Turnover',
        'Total Repurchase Obligation',
        'NPV',
      ]
      expect(headers).toEqual(expected)
    })

    it('binds Shares Turned to shares_turned column', () => {
      expect(source).toContain('r.shares_turned')
    })

    it('binds In-Service Distributions to in_service_distributions column', () => {
      expect(source).toContain('r.in_service_distributions')
    })
  })

  describe('/repurchase/share-turnover — Share Turnover Schedule', () => {
    const source = readPage('src/app/(dashboard)/repurchase/share-turnover/page.tsx')
    const headers = extractHeaders(source)

    it('renders all 7 legacy columns in order', () => {
      const expected = [
        'Plan Year',
        'Calendar Year for Payout',
        'Diversification',
        'In-Service Distributions',
        'Retirement/Death/Disability',
        'Turnover',
        'Total Shares',
      ]
      // Drop the summary tile headers (Years / Total Shares Turned / First Year / Last Year)
      // which appear before the table — we want the table's 7 <th> entries.
      // The table is the last block in the page, so take the last 7.
      expect(headers.slice(-7)).toEqual(expected)
    })

    it('renders In-Service Distributions BEFORE Retirement/Death/Disability (legacy order)', () => {
      const inServiceIdx = headers.indexOf('In-Service Distributions')
      const retirementIdx = headers.indexOf('Retirement/Death/Disability')
      expect(inServiceIdx).toBeGreaterThan(-1)
      expect(retirementIdx).toBeGreaterThan(-1)
      expect(inServiceIdx).toBeLessThan(retirementIdx)
    })
  })

  describe('/valuation — Capital Table & Valuation', () => {
    const source = readPage('src/app/(dashboard)/valuation/page.tsx')
    const headers = extractHeaders(source)

    it('renders all 9 legacy columns in order', () => {
      const expected = [
        'Year',
        'ESOP Valuation',
        'ESOP Shares',
        '% ESOP',
        'Other Shares',
        '% Other',
        'Total Shares',
        'Price/Share',
        'Price Change',
      ]
      expect(headers).toEqual(expected)
    })
  })

  describe('/population — Population Analysis', () => {
    const source = readPage('src/app/(dashboard)/population/page.tsx')
    const headers = extractHeaders(source)

    it('renders all 11 legacy columns in order', () => {
      const expected = [
        'Year',
        'Active Participants',
        'Covered Comp',
        'Avg Cash Comp',
        'Avg ESOP Comp',
        'Avg Total Comp',
        'Stock Alloc',
        'Cash Contrib',
        'Fringe',
        'Effective Benefit Rate',
        'Share Turn',
      ]
      expect(headers).toEqual(expected)
    })
  })
})
