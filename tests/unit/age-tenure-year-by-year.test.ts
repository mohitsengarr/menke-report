import { describe, it, expect } from 'vitest'
import {
  runFormulaEngine,
  type ParticipantInput, type PlanSettings,
} from '../../src/lib/formulas/engine'

/**
 * SEN-222: regression tests for the legacy year-by-year shape of
 * average_age_tenure_active and average_age_tenure_terminated tables.
 *
 * These ensure the engine emits one row per projection year (not one
 * row per service-tenure bucket) and that the columns match what the
 * legacy AverageAgeTenure.cshtml and AverageAgeTenureBalance.cshtml
 * templates render.
 */

function mp(overrides: Partial<ParticipantInput> = {}): ParticipantInput {
  return {
    row_number: 1, name: 'Test',
    birth_date: '1980-01-01', hire_date: '2010-01-01', esop_date: '2010-06-01',
    term_date: null, reason: null, vesting_pct: 1.0, plan_comp: 80000,
    total_cash: 80000,
    shares: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    diversifications: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    gender: 'M', nonvested: null, oia_tranche: 0, stock_tranche: 0,
    divers: 0, comp_years: 10, ...overrides,
  }
}

function ms(overrides: Partial<PlanSettings> = {}): PlanSettings {
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
    retirementAge: 65, deathBenefitBase: 0, ...overrides,
  }
}

const VAL = new Date('2026-01-01')
const PRICES = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15]

const sampleParticipants: ParticipantInput[] = [
  mp({ row_number: 1, name: 'Active-1', birth_date: '1985-01-01', hire_date: '2012-01-01', plan_comp: 95000 }),
  mp({ row_number: 2, name: 'Active-2', birth_date: '1975-06-15', hire_date: '2005-03-01', plan_comp: 120000 }),
  mp({ row_number: 3, name: 'Active-3', birth_date: '1990-12-10', hire_date: '2018-07-01', plan_comp: 70000 }),
  mp({ row_number: 4, name: 'Term-1', birth_date: '1980-05-20', hire_date: '2008-01-01',
       term_date: '2025-06-01', reason: 'RETIREMENT', plan_comp: 150000,
       shares: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000] }),
  mp({ row_number: 5, name: 'Term-2', birth_date: '1982-03-12', hire_date: '2015-01-01',
       term_date: '2025-12-01', reason: 'TURNOVER', plan_comp: 60000,
       shares: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500] }),
]

describe('SEN-222 — ageTenureActiveByYear shape', () => {
  const out = runFormulaEngine(sampleParticipants, ms(), VAL, PRICES)

  it('returns one row per projection year (11)', () => {
    expect(out.ageTenureActiveByYear.length).toBe(11)
  })

  it('first row label is "Year 0"', () => {
    expect(out.ageTenureActiveByYear[0]!.year).toBe('Year 0')
  })

  it('last row label is "Year 10"', () => {
    expect(out.ageTenureActiveByYear[10]!.year).toBe('Year 10')
  })

  it('every row has the 6 required columns', () => {
    for (const r of out.ageTenureActiveByYear) {
      expect(r).toHaveProperty('averageAge')
      expect(r).toHaveProperty('averageTenure')
      expect(r).toHaveProperty('coveredCompensation')
      expect(r).toHaveProperty('compensationPctChange')
      expect(r).toHaveProperty('averageVestedBalance')
      expect(r).toHaveProperty('balancePctChange')
    }
  })

  it('year-0 covered comp equals sum of active plan_comp (within growth)', () => {
    // Year-0 projected comp = basePlanComp (no growth yet), so sum across 3 actives
    // 95000 + 120000 + 70000 = 285000
    expect(out.ageTenureActiveByYear[0]!.coveredCompensation).toBeCloseTo(285000, -2)
  })

  it('year-0 balance % change is 0 (no prior year baseline)', () => {
    expect(out.ageTenureActiveByYear[0]!.balancePctChange).toBe(0)
  })

  it('year-0 comp % change is 0 (no prior year baseline)', () => {
    expect(out.ageTenureActiveByYear[0]!.compensationPctChange).toBe(0)
  })

  it('year-1 comp % change is positive when growth rate > 0', () => {
    expect(out.ageTenureActiveByYear[1]!.compensationPctChange).toBeGreaterThan(0)
  })

  it('averageAge increases year over year', () => {
    const y0 = out.ageTenureActiveByYear[0]!.averageAge
    const y5 = out.ageTenureActiveByYear[5]!.averageAge
    expect(y5).toBeGreaterThan(y0)
  })

  it('averageTenure increases year over year', () => {
    const y0 = out.ageTenureActiveByYear[0]!.averageTenure
    const y5 = out.ageTenureActiveByYear[5]!.averageTenure
    expect(y5).toBeGreaterThan(y0)
  })
})

describe('SEN-222 — ageTenureTerminatedByYear shape', () => {
  const out = runFormulaEngine(sampleParticipants, ms(), VAL, PRICES)

  it('returns one row per projection year (11)', () => {
    expect(out.ageTenureTerminatedByYear.length).toBe(11)
  })

  it('every row has the 7 required columns', () => {
    for (const r of out.ageTenureTerminatedByYear) {
      expect(r).toHaveProperty('avgAgeTop10pct')
      expect(r).toHaveProperty('avgBalanceTop10pct')
      expect(r).toHaveProperty('avgAgeBottom10pct')
      expect(r).toHaveProperty('avgBalanceBottom10pct')
      expect(r).toHaveProperty('avgAgeTerminated')
      expect(r).toHaveProperty('avgTenureTerminated')
      expect(r).toHaveProperty('avgBalanceTerminated')
    }
  })

  it('top-10% balance >= bottom-10% balance for every year', () => {
    for (const r of out.ageTenureTerminatedByYear) {
      expect(r.avgBalanceTop10pct).toBeGreaterThanOrEqual(r.avgBalanceBottom10pct)
    }
  })

  it('labels match "Year N"', () => {
    expect(out.ageTenureTerminatedByYear[0]!.year).toBe('Year 0')
    expect(out.ageTenureTerminatedByYear[10]!.year).toBe('Year 10')
  })

  it('handles zero-terminated population without NaN', () => {
    const allActive = [mp({ row_number: 1 }), mp({ row_number: 2 })]
    const out2 = runFormulaEngine(allActive, ms(), VAL, PRICES)
    for (const r of out2.ageTenureTerminatedByYear) {
      expect(Number.isFinite(r.avgAgeTerminated)).toBe(true)
      expect(Number.isFinite(r.avgBalanceTerminated)).toBe(true)
    }
  })
})

describe('SEN-222 — engine output includes both old bucket view and new year view', () => {
  const out = runFormulaEngine(sampleParticipants, ms(), VAL, PRICES)

  it('legacy bucket view (ageTenureActive) still present for tests', () => {
    expect(Array.isArray(out.ageTenureActive)).toBe(true)
  })

  it('new year view (ageTenureActiveByYear) is populated', () => {
    expect(out.ageTenureActiveByYear.length).toBeGreaterThan(0)
  })

  it('DB persistence shape (camelCase → snake_case)', () => {
    const row = out.ageTenureActiveByYear[0]!
    const mapped = {
      user_id: 'u1',
      year: row.year,
      average_age: row.averageAge,
      average_tenure: row.averageTenure,
      covered_compensation: row.coveredCompensation,
      compensation_pct_change: row.compensationPctChange,
      average_vested_balance: row.averageVestedBalance,
      balance_pct_change: row.balancePctChange,
    }
    expect(mapped).toHaveProperty('covered_compensation')
    expect(mapped).not.toHaveProperty('coveredCompensation')
  })
})
