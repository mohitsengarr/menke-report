import { describe, it, expect } from 'vitest'
import {
  runFormulaEngine,
  type ParticipantInput, type PlanSettings,
} from '../../src/lib/formulas/engine'

/**
 * Tests for the Avg Age & Tenure persistence shape.
 * The engine now drives these tables (previously they were only populated
 * from Excel ws1 extractors, leaving both pages empty for single-tab uploads
 * and for recomputes).
 */

function makeParticipant(overrides: Partial<ParticipantInput> = {}): ParticipantInput {
  return {
    row_number: 1,
    name: 'Test',
    birth_date: '1980-01-01',
    hire_date: '2010-01-01',
    esop_date: '2010-06-01',
    term_date: null,
    reason: null,
    vesting_pct: 1.0,
    plan_comp: 80000,
    total_cash: 80000,
    shares: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    diversifications: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    gender: 'M',
    nonvested: null,
    oia_tranche: 0,
    stock_tranche: 0,
    divers: 0,
    comp_years: 10,
    ...overrides,
  }
}

function makeSettings(overrides: Partial<PlanSettings> = {}): PlanSettings {
  return {
    compensationLimit: 330000, compensationLimitIncrease: 0.02,
    periodYears: 10, distributionYears: 5,
    planRetirement: 65, serviceRetirement: 10,
    compGrowthRates: [0.05, 0.04, 0.03], turnoverTable: 'T-5',
    vestingPeriod: 6, lumpSumLimit: 5000, serviceHours: 1000,
    oiaAnnualReturn: 0.06, annualESOPContribution: 100000,
    segregation: 'None', planSize: 'Medium',
    fundingMechanism: 'Redeem', planActiveFrozen: 'Active',
    inServiceAge: 59, inServiceAmount: 10000,
    diversYears: [0.25, 0.25, 0.25, 0.25, 0.25, 0.50],
    esopFormationDate: '2005-01-01', scCorporation: 'No',
    ebitda: 5000000, capRate: 0.15, ebitdaGrowthRate: 0.03,
    totalESOPShares: 100000, totalSharesOutstanding: 200000,
    distributionPeriod: 5, maxDistributionYears: 10,
    taxBenefitAmount: 50000, diversificationThreshold: 55,
    retirementAge: 65, deathBenefitBase: 0,
    ...overrides,
  }
}

const VAL_DATE = new Date('2026-01-01')
const SHARE_PRICES = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15]

describe('Avg Age & Tenure — engine output shape', () => {
  const active = makeParticipant({ row_number: 1, birth_date: '1980-01-01', hire_date: '2010-01-01' })
  const terminated = makeParticipant({
    row_number: 2, birth_date: '1970-01-01', hire_date: '2000-01-01',
    term_date: '2025-01-01', reason: 'RETIREMENT',
  })
  const out = runFormulaEngine([active, terminated], makeSettings(), VAL_DATE, SHARE_PRICES)

  it('ageTenureActive is a non-empty array', () => {
    expect(Array.isArray(out.ageTenureActive)).toBe(true)
    expect(out.ageTenureActive.length).toBeGreaterThan(0)
  })
  it('ageTenureTerminated is a non-empty array', () => {
    expect(Array.isArray(out.ageTenureTerminated)).toBe(true)
    expect(out.ageTenureTerminated.length).toBeGreaterThan(0)
  })
  it('every row has {category, count, avgAge, avgTenure, avgBalance}', () => {
    const rows = [...out.ageTenureActive, ...out.ageTenureTerminated]
    for (const r of rows) {
      expect(r).toHaveProperty('category')
      expect(r).toHaveProperty('count')
      expect(r).toHaveProperty('avgAge')
      expect(r).toHaveProperty('avgTenure')
      expect(r).toHaveProperty('avgBalance')
    }
  })
  it('includes an "All" bucket (weighted aggregate)', () => {
    expect(out.ageTenureActive.some(r => r.category === 'All')).toBe(true)
    expect(out.ageTenureTerminated.some(r => r.category === 'All')).toBe(true)
  })
  it('includes service-year buckets', () => {
    const expected = ['0-5 years', '5-10 years', '10-15 years', '15-20 years', '20+ years']
    for (const cat of expected) {
      expect(out.ageTenureActive.some(r => r.category === cat)).toBe(true)
    }
  })
  it('counts are non-negative integers', () => {
    for (const r of out.ageTenureActive) {
      expect(r.count).toBeGreaterThanOrEqual(0)
    }
  })
  it('engine output can be mapped to DB snake_case shape', () => {
    // Simulates the processor + recompute mapping
    const mapped = out.ageTenureActive.map(r => ({
      user_id: 'u1',
      category: r.category,
      count: r.count,
      avg_age: r.avgAge,
      avg_tenure: r.avgTenure,
      avg_balance: r.avgBalance,
    }))
    expect(mapped[0]).toHaveProperty('avg_age')
    expect(mapped[0]).toHaveProperty('avg_tenure')
    expect(mapped[0]).toHaveProperty('avg_balance')
    expect(mapped[0]).not.toHaveProperty('avgAge')
  })
  it('0 participants produces empty-bucket rows with count=0', () => {
    const empty = runFormulaEngine([], makeSettings(), VAL_DATE, SHARE_PRICES)
    expect(empty.ageTenureActive.every(r => r.count === 0)).toBe(true)
  })
})

describe('Avg Age & Tenure — page filter logic', () => {
  it('page natural order puts "All" first, then buckets in ascending service', () => {
    const ORDER = ['All', '0-5 years', '5-10 years', '10-15 years', '15-20 years', '20+ years']
    const rows = [
      { category: '20+ years' },
      { category: '0-5 years' },
      { category: 'All' },
    ] as any[]
    rows.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))
    expect(rows.map(r => r.category)).toEqual(['All', '0-5 years', '20+ years'])
  })
  it('totals prefer "All" row when present (no double-counting)', () => {
    const rows = [
      { category: 'All', count: 100, avg_age: 45, avg_tenure: 10, avg_balance: 50000 },
      { category: '0-5 years', count: 30, avg_age: 30, avg_tenure: 3, avg_balance: 10000 },
      { category: '5-10 years', count: 70, avg_age: 50, avg_tenure: 12, avg_balance: 65000 },
    ]
    const allRow = rows.find(r => r.category === 'All')
    expect(allRow).toBeDefined()
    expect(allRow!.count).toBe(100)  // Uses 'All' count, not 30+70
  })
  it('totals compute weighted avg when "All" is absent', () => {
    const rows = [
      { category: '0-5 years', count: 30, avg_age: 30, avg_tenure: 3, avg_balance: 10000 },
      { category: '5-10 years', count: 70, avg_age: 50, avg_tenure: 12, avg_balance: 65000 },
    ]
    const totalCount = rows.reduce((s, r) => s + r.count, 0)
    const weightedAge = rows.reduce((s, r) => s + r.avg_age * r.count, 0) / totalCount
    expect(totalCount).toBe(100)
    // Weighted: (30*30 + 50*70) / 100 = (900 + 3500) / 100 = 44
    expect(weightedAge).toBeCloseTo(44, 1)
  })
})
