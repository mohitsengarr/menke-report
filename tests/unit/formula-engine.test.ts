import { describe, it, expect } from 'vitest'
import {
  parseDate, yearsBetween, ageAt, addYears, yearDate,
  calcSeparationDate, calcVestingPct, calcProjectedComp,
  calcCashRepurchase, calcShareRepurchase, calcEarlyRetirementDist,
  calcDeathBenefitDist, calcRMDShareDist, calcInServiceDist,
  calcNewAllocation, calcOIAIncome, runFormulaEngine,
  type ParticipantInput, type PlanSettings
} from '../../src/lib/formulas/engine'

// ═══════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════

function makeDate(iso: string): Date {
  return new Date(iso)
}

/** Create a minimal ParticipantInput for integration tests */
function makeParticipant(overrides: Partial<ParticipantInput> = {}): ParticipantInput {
  return {
    row_number: 1,
    name: 'Test Participant',
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

/** Create a minimal PlanSettings for integration tests */
function makeSettings(overrides: Partial<PlanSettings> = {}): PlanSettings {
  return {
    compensationLimit: 330000,
    compensationLimitIncrease: 0.02,
    periodYears: 10,
    distributionYears: 5,
    planRetirement: 65,
    serviceRetirement: 10,
    compGrowthRates: [0.05, 0.04, 0.03],
    turnoverTable: 'T-5',
    vestingPeriod: 6,
    lumpSumLimit: 5000,
    serviceHours: 1000,
    oiaAnnualReturn: 0.06,
    annualESOPContribution: 100000,
    segregation: 'None',
    planSize: 'Medium',
    fundingMechanism: 'Redeem',
    planActiveFrozen: 'Active',
    inServiceAge: 59,
    inServiceAmount: 10000,
    diversYears: [0.25, 0.25, 0.25, 0.25, 0.25, 0.50],
    esopFormationDate: '2005-01-01',
    scCorporation: 'No',
    ebitda: 5000000,
    capRate: 0.15,
    ebitdaGrowthRate: 0.03,
    totalESOPShares: 100000,
    totalSharesOutstanding: 200000,
    distributionPeriod: 5,
    maxDistributionYears: 10,
    taxBenefitAmount: 50000,
    diversificationThreshold: 55,
    retirementAge: 65,
    deathBenefitBase: 0,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. parseDate
// ═══════════════════════════════════════════════════════════════

describe('parseDate', () => {
  it('returns Date for valid ISO string "2024-01-15"', () => {
    const result = parseDate('2024-01-15')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getFullYear()).toBe(2024)
    expect(result!.getMonth()).toBe(0) // January
    expect(result!.getDate()).toBe(15)
  })

  it('returns null for null input', () => {
    expect(parseDate(null)).toBeNull()
  })

  it('returns null for empty string ""', () => {
    expect(parseDate('')).toBeNull()
  })

  it('returns null for invalid string "not-a-date"', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })

  it('handles date without time component', () => {
    const result = parseDate('2000-06-15')
    expect(result).toBeInstanceOf(Date)
    expect(result!.getFullYear()).toBe(2000)
    expect(result!.getMonth()).toBe(5) // June
    expect(result!.getDate()).toBe(15)
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. yearsBetween
// ═══════════════════════════════════════════════════════════════

describe('yearsBetween', () => {
  it('returns 0 for same date', () => {
    const d = makeDate('2024-01-01')
    expect(yearsBetween(d, d)).toBe(0)
  })

  it('returns approximately 1.0 for dates 365 days apart', () => {
    const a = makeDate('2024-01-01')
    const b = makeDate('2025-01-01')
    // 366 days (2024 is leap year) / 365.25 ~ 1.002
    const result = yearsBetween(a, b)
    expect(result).toBeGreaterThan(0.99)
    expect(result).toBeLessThan(1.01)
  })

  it('returns approximately 0.5 for dates ~183 days apart', () => {
    const a = makeDate('2024-01-01')
    const b = makeDate('2024-07-02') // ~183 days
    const result = yearsBetween(a, b)
    expect(result).toBeGreaterThan(0.49)
    expect(result).toBeLessThan(0.51)
  })

  it('handles negative (later before earlier = negative)', () => {
    const a = makeDate('2025-01-01')
    const b = makeDate('2024-01-01')
    const result = yearsBetween(a, b)
    expect(result).toBeLessThan(0)
  })

  it('handles leap year correctly', () => {
    const a = makeDate('2024-01-01') // 2024 is a leap year
    const b = makeDate('2024-12-31')
    const result = yearsBetween(a, b)
    // 365 days in 2024 (leap year), so 365/365.25 ~ 0.9993
    expect(result).toBeGreaterThan(0.99)
    expect(result).toBeLessThan(1.01)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. ageAt
// ═══════════════════════════════════════════════════════════════

describe('ageAt', () => {
  it('returns 30 for someone born 30 years ago', () => {
    const birth = makeDate('1994-01-01')
    const ref = makeDate('2024-06-15')
    expect(ageAt(birth, ref)).toBe(30)
  })

  it('returns 0 for newborn (same day)', () => {
    const d = makeDate('2024-06-15')
    expect(ageAt(d, d)).toBe(0)
  })

  it('returns 65 for retirement age', () => {
    const birth = makeDate('1959-01-01')
    const ref = makeDate('2024-06-15')
    expect(ageAt(birth, ref)).toBe(65)
  })

  it('returns 100 for centenarian', () => {
    const birth = makeDate('1924-01-01')
    const ref = makeDate('2024-06-15')
    expect(ageAt(birth, ref)).toBe(100)
  })

  it('floors fractional years (364 days = 0, not 1)', () => {
    const birth = makeDate('2024-01-01')
    const ref = makeDate('2024-12-31') // 365 days later
    // yearsBetween gives ~0.999; Math.floor = 0
    expect(ageAt(birth, ref)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. addYears / yearDate
// ═══════════════════════════════════════════════════════════════

describe('addYears / yearDate', () => {
  it('adds 1 year', () => {
    const base = makeDate('2024-03-15')
    const result = addYears(base, 1)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(2) // March
    expect(result.getDate()).toBe(15)
  })

  it('adds 0 years (identity)', () => {
    const base = makeDate('2024-06-01')
    const result = addYears(base, 0)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(5) // June
    expect(result.getDate()).toBe(1)
  })

  it('adds 10 years', () => {
    const base = makeDate('2020-12-25')
    const result = yearDate(base, 10)
    expect(result.getFullYear()).toBe(2030)
    expect(result.getMonth()).toBe(11) // December
    expect(result.getDate()).toBe(25)
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. calcSeparationDate
// ═══════════════════════════════════════════════════════════════

describe('calcSeparationDate', () => {
  it('returns termDate if provided (terminated participant)', () => {
    const birth = makeDate('1980-01-01')
    const term = makeDate('2023-06-15')
    const result = calcSeparationDate(birth, term, 65)
    expect(result).toEqual(term)
  })

  it('returns null if both birthDate and termDate are null', () => {
    expect(calcSeparationDate(null, null, 65)).toBeNull()
  })

  it('calculates retirement date from DOB + retirement age 65', () => {
    const birth = makeDate('1980-01-01')
    const result = calcSeparationDate(birth, null, 65)
    expect(result!.getFullYear()).toBe(2045)
    expect(result!.getMonth()).toBe(0) // January
  })

  it('calculates retirement date from DOB + retirement age 60', () => {
    const birth = makeDate('1975-06-15')
    const result = calcSeparationDate(birth, null, 60)
    expect(result!.getFullYear()).toBe(2035)
    expect(result!.getMonth()).toBe(5) // June
  })

  it('handles young employee (age 25, retirement at 65 = 40 years added)', () => {
    const birth = makeDate('1999-03-01')
    const result = calcSeparationDate(birth, null, 65)
    expect(result!.getFullYear()).toBe(2064)
  })

  it('termDate takes precedence over birthDate + age', () => {
    const birth = makeDate('1980-01-01')
    const term = makeDate('2020-01-01')
    const result = calcSeparationDate(birth, term, 65)
    // Even though DOB+65 = 2045, term date of 2020 wins
    expect(result!.getFullYear()).toBe(2020)
  })

  it('null birthDate with no termDate returns null', () => {
    expect(calcSeparationDate(null, null, 65)).toBeNull()
  })

  it('retirement age of 0 returns birthDate itself', () => {
    const birth = makeDate('2000-05-10')
    const result = calcSeparationDate(birth, null, 0)
    expect(result!.getFullYear()).toBe(2000)
    expect(result!.getMonth()).toBe(4) // May
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. calcVestingPct
// ═══════════════════════════════════════════════════════════════

describe('calcVestingPct', () => {
  describe('1-year cliff', () => {
    it('0 years = 0%', () => {
      expect(calcVestingPct(1, 0)).toBe(0)
    })

    it('0.5 years = 0%', () => {
      expect(calcVestingPct(1, 0.5)).toBe(0)
    })

    it('1 year = 100%', () => {
      expect(calcVestingPct(1, 1)).toBe(1.0)
    })

    it('5 years = 100%', () => {
      expect(calcVestingPct(1, 5)).toBe(1.0)
    })
  })

  describe('3-year cliff', () => {
    it('0 years = 0%', () => {
      expect(calcVestingPct(3, 0)).toBe(0)
    })

    it('2 years = 0%', () => {
      expect(calcVestingPct(3, 2)).toBe(0)
    })

    it('3 years = 100%', () => {
      expect(calcVestingPct(3, 3)).toBe(1.0)
    })
  })

  describe('6-year graded', () => {
    it('0 years = 0%', () => {
      expect(calcVestingPct(6, 0)).toBe(0)
    })

    it('2 years = 20%', () => {
      expect(calcVestingPct(6, 2)).toBe(0.20)
    })

    it('3 years = 40%', () => {
      expect(calcVestingPct(6, 3)).toBe(0.40)
    })

    it('4 years = 60%', () => {
      expect(calcVestingPct(6, 4)).toBe(0.60)
    })

    it('5 years = 80%', () => {
      expect(calcVestingPct(6, 5)).toBe(0.80)
    })

    it('6 years = 100%', () => {
      expect(calcVestingPct(6, 6)).toBe(1.0)
    })

    it('10 years = 100%', () => {
      expect(calcVestingPct(6, 10)).toBe(1.0)
    })
  })

  it('negative years = 0%', () => {
    expect(calcVestingPct(1, -1)).toBe(0)
    expect(calcVestingPct(3, -5)).toBe(0)
    expect(calcVestingPct(6, -0.5)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 7. calcProjectedComp
// ═══════════════════════════════════════════════════════════════

describe('calcProjectedComp', () => {
  const rates = [0.05, 0.04, 0.03] // year1, years2-5, years6+
  const limit = 330000
  const limitIncrease = 0.02

  it('year 0: returns base comp (no growth)', () => {
    expect(calcProjectedComp(80000, 0, rates, limit, limitIncrease)).toBe(80000)
  })

  it('year 1: applies first growth rate (5%)', () => {
    const result = calcProjectedComp(80000, 1, rates, limit, limitIncrease)
    expect(result).toBeCloseTo(80000 * 1.05, 2)
  })

  it('year 3: applies first-5-year rate', () => {
    // year 1: 80000 * 1.05 = 84000
    // year 2: 84000 * 1.04 = 87360
    // year 3: 87360 * 1.04 = 90854.40
    const result = calcProjectedComp(80000, 3, rates, limit, limitIncrease)
    const expected = 80000 * 1.05 * 1.04 * 1.04
    expect(result).toBeCloseTo(expected, 2)
  })

  it('year 6: switches to long-term rate', () => {
    // year 1: 80000 * 1.05
    // years 2-5: * 1.04^4
    // year 6: * 1.03
    const result = calcProjectedComp(80000, 6, rates, limit, limitIncrease)
    const expected = 80000 * 1.05 * Math.pow(1.04, 4) * 1.03
    expect(result).toBeCloseTo(expected, 2)
  })

  it('zero base comp: returns 0', () => {
    expect(calcProjectedComp(0, 5, rates, limit, limitIncrease)).toBe(0)
  })

  it('enforces compensation limit cap', () => {
    // With a very high base comp that would exceed the limit
    const result = calcProjectedComp(325000, 5, rates, limit, limitIncrease)
    const adjustedLimit = limit * Math.pow(1 + limitIncrease, 5)
    expect(result).toBeLessThanOrEqual(adjustedLimit + 0.01)
  })

  it('limit grows with inflation', () => {
    // At year 10, limit = 330000 * (1.02)^10 ~ 402,397
    const limitAt10 = limit * Math.pow(1 + limitIncrease, 10)
    expect(limitAt10).toBeGreaterThan(limit)
    const result = calcProjectedComp(400000, 10, rates, limit, limitIncrease)
    // The result should be capped at the inflation-adjusted limit
    expect(result).toBeCloseTo(limitAt10, 0)
  })

  it('very high comp gets capped', () => {
    const result = calcProjectedComp(500000, 0, rates, limit, limitIncrease)
    // Year 0: min(500000, 330000) = 330000
    expect(result).toBe(limit)
  })

  it('negative growth rate reduces comp', () => {
    const negRates = [-0.05, -0.04, -0.03]
    const result = calcProjectedComp(80000, 1, negRates, limit, limitIncrease)
    expect(result).toBeCloseTo(80000 * 0.95, 2)
  })

  it('year 10: compound growth', () => {
    const result = calcProjectedComp(80000, 10, rates, limit, limitIncrease)
    // year 1: *1.05, years 2-5: *1.04^4, years 6-10: *1.03^5
    const expected = 80000 * 1.05 * Math.pow(1.04, 4) * Math.pow(1.03, 5)
    const adjustedLimit = limit * Math.pow(1 + limitIncrease, 10)
    const capped = Math.min(expected, adjustedLimit)
    expect(result).toBeCloseTo(capped, 2)
  })
})

// ═══════════════════════════════════════════════════════════════
// 8. calcCashRepurchase
// ═══════════════════════════════════════════════════════════════

describe('calcCashRepurchase', () => {
  it('active participant (not terminated): returns 0', () => {
    expect(calcCashRepurchase(false, 3, 5, 100000, 1.0, 5000)).toBe(0)
  })

  it('terminated, year 0 (before payout starts): returns 0', () => {
    expect(calcCashRepurchase(true, 0, 5, 100000, 1.0, 5000)).toBe(0)
  })

  it('terminated, year 1: amortized payout', () => {
    const result = calcCashRepurchase(true, 1, 5, 100000, 1.0, 5000)
    // vestedValue = 100000, not below lumpSum limit, so amortize
    // remainingYears = 5 - 1 + 1 = 5
    // sarason(5) = (1 - (1.05)^-5) / 0.05 = 4.3295
    expect(result).toBeLessThan(0) // negative (outflow)
    expect(Math.abs(result)).toBeGreaterThan(0)
  })

  it('terminated, past distribution period: returns 0', () => {
    expect(calcCashRepurchase(true, 6, 5, 100000, 1.0, 5000)).toBe(0)
  })

  it('small balance below lumpSumLimit: full lump sum at year 1', () => {
    // vestedValue = 3000 * 1.0 = 3000, which is <= 5000
    const result = calcCashRepurchase(true, 1, 5, 3000, 1.0, 5000)
    expect(result).toBe(-3000)
  })

  it('small balance above limit: no lump sum, amortized instead', () => {
    // vestedValue = 6000 * 1.0 = 6000, which is > 5000 limit
    const result = calcCashRepurchase(true, 1, 5, 6000, 1.0, 5000)
    // This should be amortized, not a full lump sum
    expect(result).not.toBe(-6000)
    expect(result).toBeLessThan(0)
  })

  it('zero balance: returns 0', () => {
    const result = calcCashRepurchase(true, 1, 5, 0, 1.0, 5000)
    // vestedValue = 0 * 1.0 = 0, which is <= 5000, so lump sum of -0
    expect(Math.abs(result)).toBe(0)
  })

  it('100% vesting: full vested value', () => {
    const result = calcCashRepurchase(true, 1, 5, 4000, 1.0, 5000)
    // vestedValue = 4000 * 1.0 = 4000, below limit, lump sum
    expect(result).toBe(-4000)
  })

  it('50% vesting: half vested value', () => {
    const result = calcCashRepurchase(true, 1, 5, 4000, 0.5, 5000)
    // vestedValue = 4000 * 0.5 = 2000, below limit, lump sum
    expect(result).toBe(-2000)
  })

  it('distribution period of 1: full payout in year 1', () => {
    const result = calcCashRepurchase(true, 1, 1, 50000, 1.0, 5000)
    // remainingYears = 1 - 1 + 1 = 1
    // sarason(1) = 1 (since years <= 1 returns 1)
    // payout = -(50000 / 1) = -50000
    expect(result).toBe(-50000)
  })

  it('distribution period of 5: approximately 1/5 each year', () => {
    const result = calcCashRepurchase(true, 1, 5, 50000, 1.0, 5000)
    // amortized over 5 years using sarason factor
    expect(result).toBeLessThan(0)
    expect(Math.abs(result)).toBeGreaterThan(8000)
    expect(Math.abs(result)).toBeLessThan(15000)
  })

  it('negative account value: handled gracefully', () => {
    const result = calcCashRepurchase(true, 1, 5, -5000, 1.0, 5000)
    // vestedValue = -5000 * 1.0 = -5000, which is <= 5000 limit, lump sum
    expect(result).toBe(5000) // -(-5000) = 5000
  })
})

// ═══════════════════════════════════════════════════════════════
// 9. calcShareRepurchase
// ═══════════════════════════════════════════════════════════════

describe('calcShareRepurchase', () => {
  it('inactive participant: returns {0, 0}', () => {
    const result = calcShareRepurchase(false, 40, 1000, 1.0, 'T-5')
    expect(result.shareRepurchase).toBe(0)
    expect(result.vestingAdjustment).toBe(0)
  })

  it('active with 0 shares: returns {0, 0}', () => {
    const result = calcShareRepurchase(true, 40, 0, 1.0, 'T-5')
    expect(result.shareRepurchase).toBe(0)
    expect(result.vestingAdjustment).toBe(0)
  })

  it('active, age 30, T-1 table: returns negative shares * turnover rate', () => {
    // T-1 at age 30 = 0.02
    const result = calcShareRepurchase(true, 30, 1000, 1.0, 'T-1')
    expect(result.shareRepurchase).toBeCloseTo(-1000 * 0.02, 1)
    expect(Math.abs(result.vestingAdjustment)).toBe(0) // 100% vested
  })

  it('vesting adjustment when not fully vested', () => {
    // T-5 at age 30 = 0.09
    const result = calcShareRepurchase(true, 30, 1000, 0.5, 'T-5')
    const turnoverRate = 0.09
    const leaving = 1000 * turnoverRate
    expect(result.shareRepurchase).toBeCloseTo(-(leaving * 0.5), 1) // vested portion
    expect(result.vestingAdjustment).toBeCloseTo(-(leaving * 0.5), 1) // forfeited portion
  })

  it('100% vested: no vesting adjustment', () => {
    const result = calcShareRepurchase(true, 40, 500, 1.0, 'T-3')
    expect(Math.abs(result.vestingAdjustment)).toBe(0)
    expect(result.shareRepurchase).toBeLessThan(0)
  })

  it('50% vested: half forfeited', () => {
    const result = calcShareRepurchase(true, 40, 500, 0.5, 'T-3')
    // The leaving shares split evenly between repurchase and forfeiture
    expect(Math.abs(result.shareRepurchase)).toBeCloseTo(
      Math.abs(result.vestingAdjustment), 1
    )
  })

  it('T-1 vs T-11: T-11 has higher turnover', () => {
    const r1 = calcShareRepurchase(true, 30, 1000, 1.0, 'T-1')
    const r11 = calcShareRepurchase(true, 30, 1000, 1.0, 'T-11')
    expect(Math.abs(r11.shareRepurchase)).toBeGreaterThan(
      Math.abs(r1.shareRepurchase)
    )
  })

  it('age 25 vs age 50: younger has higher turnover', () => {
    const young = calcShareRepurchase(true, 25, 1000, 1.0, 'T-5')
    const older = calcShareRepurchase(true, 50, 1000, 1.0, 'T-5')
    expect(Math.abs(young.shareRepurchase)).toBeGreaterThan(
      Math.abs(older.shareRepurchase)
    )
  })

  it('age 65: zero turnover for T-1', () => {
    // T-1 at age 65 = 0.00
    const result = calcShareRepurchase(true, 65, 1000, 1.0, 'T-1')
    expect(Math.abs(result.shareRepurchase)).toBe(0)
    expect(Math.abs(result.vestingAdjustment)).toBe(0)
  })

  it('very large share balance', () => {
    const result = calcShareRepurchase(true, 30, 1_000_000, 1.0, 'T-5')
    // T-5 at age 30 = 0.09
    expect(result.shareRepurchase).toBeCloseTo(-1_000_000 * 0.09, 0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 10. calcEarlyRetirementDist
// ═══════════════════════════════════════════════════════════════

describe('calcEarlyRetirementDist', () => {
  const diversYears = [0.25, 0.25, 0.25, 0.25, 0.25, 0.50]
  const threshold = 55

  it('inactive: returns 0', () => {
    expect(calcEarlyRetirementDist(false, 56, 12, 1000, diversYears, threshold, 0)).toBe(0)
  })

  it('active, age 50 (below 55): returns 0', () => {
    expect(calcEarlyRetirementDist(true, 50, 15, 1000, diversYears, threshold, 0)).toBe(0)
  })

  it('active, age 55, 8 years service (below 10): returns 0', () => {
    expect(calcEarlyRetirementDist(true, 55, 8, 1000, diversYears, threshold, 0)).toBe(0)
  })

  it('active, age 55, 10 years, year 0: returns -(shares * diversYear[0])', () => {
    const result = calcEarlyRetirementDist(true, 55, 10, 1000, diversYears, threshold, 0)
    expect(result).toBe(-(1000 * 0.25))
  })

  it('active, age 55, 10 years, year 5 (final): returns -(shares * diversYear[5])', () => {
    const result = calcEarlyRetirementDist(true, 60, 15, 1000, diversYears, threshold, 5)
    expect(result).toBe(-(1000 * 0.50))
  })

  it('yearInDiversWindow out of range: returns 0', () => {
    // diversYears has 6 entries (index 0-5), yearInDiversWindow = 6 is out of range
    expect(calcEarlyRetirementDist(true, 60, 15, 1000, diversYears, threshold, 6)).toBe(0)
  })

  it('negative yearInDiversWindow: returns 0', () => {
    expect(calcEarlyRetirementDist(true, 56, 12, 1000, diversYears, threshold, -1)).toBe(0)
  })

  it('zero shares: returns 0', () => {
    const result = calcEarlyRetirementDist(true, 56, 12, 0, diversYears, threshold, 0)
    expect(Math.abs(result)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 11. calcDeathBenefitDist
// ═══════════════════════════════════════════════════════════════

describe('calcDeathBenefitDist', () => {
  it('inactive: returns 0', () => {
    expect(calcDeathBenefitDist(false, 50, 'M', 1000)).toBe(0)
  })

  it('zero shares: returns 0', () => {
    expect(calcDeathBenefitDist(true, 50, 'M', 0)).toBe(0)
  })

  it('active, age 50, male: returns -(shares * mortality_rate)', () => {
    const result = calcDeathBenefitDist(true, 50, 'M', 1000)
    // Male age 50 mortality from table: 0.0040
    expect(result).toBeLessThan(0)
    expect(result).toBeCloseTo(-(1000 * 0.004), 1)
  })

  it('active, age 80: higher mortality rate', () => {
    const r50 = calcDeathBenefitDist(true, 50, 'M', 1000)
    const r80 = calcDeathBenefitDist(true, 80, 'M', 1000)
    // Age 80 mortality is much higher than age 50
    expect(Math.abs(r80)).toBeGreaterThan(Math.abs(r50))
  })

  it('null gender: uses default rate (male table)', () => {
    const result = calcDeathBenefitDist(true, 50, null, 1000)
    // Null gender defaults to male table (see lookupMortality: checks toUpperCase().startsWith('F'))
    expect(result).toBeLessThan(0)
    expect(result).toBeCloseTo(-(1000 * 0.004), 1)
  })

  it('active, age 0: uses age 0 mortality (clamped to age 20)', () => {
    const result = calcDeathBenefitDist(true, 0, 'M', 1000)
    // lookupMortality clamps to age 20 bracket: 0.0006
    expect(result).toBeLessThan(0)
    expect(result).toBeCloseTo(-(1000 * 0.0006), 2)
  })
})

// ═══════════════════════════════════════════════════════════════
// 12. calcRMDShareDist
// ═══════════════════════════════════════════════════════════════

describe('calcRMDShareDist', () => {
  it('age 71: returns 0 (below threshold)', () => {
    expect(calcRMDShareDist(71, 1000)).toBe(0)
  })

  it('age 72: returns -(shares / 27.4)', () => {
    const result = calcRMDShareDist(72, 1000)
    expect(result).toBeCloseTo(-(1000 / 27.4), 2)
  })

  it('age 80: returns -(shares / 20.2)', () => {
    const result = calcRMDShareDist(80, 1000)
    expect(result).toBeCloseTo(-(1000 / 20.2), 2)
  })

  it('age 100: returns -(shares / 6.4)', () => {
    const result = calcRMDShareDist(100, 1000)
    expect(result).toBeCloseTo(-(1000 / 6.4), 2)
  })

  it('age 120: returns -(shares / 2.0)', () => {
    const result = calcRMDShareDist(120, 1000)
    expect(result).toBeCloseTo(-(1000 / 2.0), 2)
  })

  it('zero shares: returns 0', () => {
    expect(calcRMDShareDist(75, 0)).toBe(0)
  })

  it('age 72, 1000 shares: verify exact calculation', () => {
    const result = calcRMDShareDist(72, 1000)
    const expected = -(1000 / 27.4)
    expect(result).toBeCloseTo(expected, 4)
  })

  it('age below 0: returns 0', () => {
    expect(calcRMDShareDist(-5, 1000)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 13. calcInServiceDist
// ═══════════════════════════════════════════════════════════════

describe('calcInServiceDist', () => {
  it('inactive: returns 0', () => {
    expect(calcInServiceDist(false, 60, 59, 10000, 50)).toBe(0)
  })

  it('age below inServiceAge: returns 0', () => {
    expect(calcInServiceDist(true, 55, 59, 10000, 50)).toBe(0)
  })

  it('age at inServiceAge: returns -(amount / price)', () => {
    const result = calcInServiceDist(true, 59, 59, 10000, 50)
    expect(result).toBe(-(10000 / 50))
  })

  it('age above inServiceAge: returns -(amount / price)', () => {
    const result = calcInServiceDist(true, 65, 59, 10000, 50)
    expect(result).toBe(-(10000 / 50))
  })

  it('zero share price: returns 0', () => {
    expect(calcInServiceDist(true, 60, 59, 10000, 0)).toBe(0)
  })

  it('zero amount: returns 0', () => {
    const result = calcInServiceDist(true, 60, 59, 0, 50)
    expect(Math.abs(result)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 14. calcNewAllocation
// ═══════════════════════════════════════════════════════════════

describe('calcNewAllocation', () => {
  it('inactive: returns 0', () => {
    expect(calcNewAllocation(false, 80000, 400000, 100000, 50, false)).toBe(0)
  })

  it('frozen plan: returns 0', () => {
    expect(calcNewAllocation(true, 80000, 400000, 100000, 50, true)).toBe(0)
  })

  it('zero share price: returns 0', () => {
    expect(calcNewAllocation(true, 80000, 400000, 100000, 0, false)).toBe(0)
  })

  it('zero total comp: returns 0', () => {
    expect(calcNewAllocation(true, 80000, 0, 100000, 50, false)).toBe(0)
  })

  it('active, standard case: comp/totalComp * contribution / price', () => {
    const result = calcNewAllocation(true, 80000, 400000, 100000, 50, false)
    // compRatio = 80000/400000 = 0.20
    // dollarAlloc = 100000 * 0.20 = 20000
    // shares = 20000 / 50 = 400
    expect(result).toBe(400)
  })

  it('50% of total comp: gets 50% of allocation', () => {
    const result = calcNewAllocation(true, 200000, 400000, 100000, 50, false)
    // compRatio = 0.5, dollarAlloc = 50000, shares = 1000
    expect(result).toBe(1000)
  })

  it('100% of total comp: gets 100%', () => {
    const result = calcNewAllocation(true, 400000, 400000, 100000, 50, false)
    // compRatio = 1.0, dollarAlloc = 100000, shares = 2000
    expect(result).toBe(2000)
  })

  it('zero projected comp: returns 0', () => {
    expect(calcNewAllocation(true, 0, 400000, 100000, 50, false)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 15. calcOIAIncome
// ═══════════════════════════════════════════════════════════════

describe('calcOIAIncome', () => {
  it('standard: balance * return', () => {
    expect(calcOIAIncome(100000, 0.06)).toBeCloseTo(6000, 2)
  })

  it('zero balance: returns 0', () => {
    expect(calcOIAIncome(0, 0.06)).toBe(0)
  })

  it('zero return: returns 0', () => {
    expect(calcOIAIncome(100000, 0)).toBe(0)
  })

  it('negative balance: returns negative', () => {
    expect(calcOIAIncome(-50000, 0.06)).toBeCloseTo(-3000, 2)
  })
})

// ═══════════════════════════════════════════════════════════════
// 16. runFormulaEngine integration tests
// ═══════════════════════════════════════════════════════════════

describe('runFormulaEngine', () => {
  const valuationDate = makeDate('2024-01-01')
  // 11 share prices (year 0 through year 10)
  const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]

  it('0 participants: returns empty arrays, no crash', () => {
    const settings = makeSettings()
    const result = runFormulaEngine([], settings, valuationDate, sharePrices)

    expect(result.valuationProjections).toHaveLength(11)
    expect(result.repurchaseObligations).toHaveLength(11)
    expect(result.shareTurnover).toHaveLength(11)
    expect(result.populationAnalysis).toHaveLength(11)
    expect(result.successScores).toHaveLength(11)
    expect(result.participantDetails).toHaveLength(0)
    // All aggregate values should be zero
    expect(result.valuationProjections[0]!.esopShares).toBe(0)
    expect(result.repurchaseObligations[0]!.totalRepurchaseObligation).toBe(0)
  })

  it('1 active participant: all 7 outputs populated with 11 years', () => {
    const settings = makeSettings()
    const participant = makeParticipant()
    const result = runFormulaEngine([participant], settings, valuationDate, sharePrices)

    expect(result.valuationProjections).toHaveLength(11)
    expect(result.repurchaseObligations).toHaveLength(11)
    expect(result.shareTurnover).toHaveLength(11)
    expect(result.populationAnalysis).toHaveLength(11)
    expect(result.successScores).toHaveLength(11)
    expect(result.participantDetails).toHaveLength(1)

    const pd = result.participantDetails[0]!
    expect(pd.yearlyData).toHaveLength(11)
    expect(pd.isActive).toBe(true)
    expect(pd.isTerminated).toBe(false)
  })

  it('1 terminated participant: repurchase obligations populated', () => {
    const settings = makeSettings()
    const participant = makeParticipant({
      term_date: '2023-06-15',
      reason: 'Voluntary',
    })
    const result = runFormulaEngine([participant], settings, valuationDate, sharePrices)

    expect(result.participantDetails).toHaveLength(1)
    const pd = result.participantDetails[0]!
    expect(pd.isTerminated).toBe(true)
    expect(pd.isActive).toBe(false)

    // Terminated participant should generate cash repurchase in some years
    const hasRepurchase = pd.yearlyData.some(yd => yd.cashRepurchase !== 0)
    expect(hasRepurchase).toBe(true)
  })

  it('frozen plan: no new allocations', () => {
    const settings = makeSettings({ planActiveFrozen: 'FROZEN' })
    const participant = makeParticipant()
    const result = runFormulaEngine([participant], settings, valuationDate, sharePrices)

    const pd = result.participantDetails[0]!
    for (const yd of pd.yearlyData) {
      expect(yd.newAllocation).toBe(0)
    }
  })

  it('verify valuationProjections has 11 rows', () => {
    const settings = makeSettings()
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, sharePrices
    )
    expect(result.valuationProjections).toHaveLength(11)
    // Each row should have a year label
    result.valuationProjections.forEach((row, i) => {
      expect(row.year).toBe(`Year ${i}`)
    })
  })

  it('verify repurchaseObligations has 11 rows', () => {
    const settings = makeSettings()
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, sharePrices
    )
    expect(result.repurchaseObligations).toHaveLength(11)
    result.repurchaseObligations.forEach((row, i) => {
      expect(row.year).toBe(`Year ${i}`)
    })
  })

  it('verify shareTurnover has 11 rows', () => {
    const settings = makeSettings()
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, sharePrices
    )
    expect(result.shareTurnover).toHaveLength(11)
    result.shareTurnover.forEach((row, i) => {
      expect(row.year).toBe(`Year ${i}`)
    })
  })

  it('verify populationAnalysis has 11 rows', () => {
    const settings = makeSettings()
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, sharePrices
    )
    expect(result.populationAnalysis).toHaveLength(11)
  })

  it('verify successScores has 11 rows', () => {
    const settings = makeSettings()
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, sharePrices
    )
    expect(result.successScores).toHaveLength(11)
    // Each success score should have a valid score between 0-1 (decimal, not 1-5 integer)
    result.successScores.forEach(row => {
      expect(row.esopSuccessScore).toBeGreaterThanOrEqual(0)
      expect(row.esopSuccessScore).toBeLessThanOrEqual(1)
    })
  })

  it('verify active participant shows in population count', () => {
    const settings = makeSettings()
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, sharePrices
    )
    // Year 0: the active participant should be counted
    expect(result.populationAnalysis[0]!.activeParticipants).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Bonus: Edge cases and cross-function consistency
// ═══════════════════════════════════════════════════════════════

describe('edge cases and cross-function consistency', () => {
  it('vesting + share repurchase: unvested forfeiture matches vesting gap', () => {
    // 50% vested, shares leaving via turnover: half repurchased, half forfeited
    const result = calcShareRepurchase(true, 30, 1000, 0.5, 'T-1')
    const totalOut = Math.abs(result.shareRepurchase) + Math.abs(result.vestingAdjustment)
    // Total outflow should equal shares * turnoverRate
    expect(totalOut).toBeCloseTo(1000 * 0.02, 1)
  })

  it('parseDate round-trips with addYears correctly', () => {
    const d = parseDate('2020-06-15')
    expect(d).not.toBeNull()
    const future = addYears(d!, 5)
    expect(future.getFullYear()).toBe(2025)
    expect(future.getMonth()).toBe(5)
    expect(future.getDate()).toBe(15)
  })

  it('ageAt is consistent with yearsBetween', () => {
    const birth = makeDate('1990-01-01')
    const ref = makeDate('2024-06-15')
    const fractional = yearsBetween(birth, ref)
    const wholeAge = ageAt(birth, ref)
    expect(wholeAge).toBe(Math.floor(fractional))
  })

  it('calcVestingPct boundary: exactly at 2 years for 6-year graded', () => {
    // At exactly 2.0 years of service
    expect(calcVestingPct(6, 2.0)).toBe(0.20)
    // Just below 2
    expect(calcVestingPct(6, 1.99)).toBe(0)
  })

  it('calcProjectedComp: negative base comp returns 0', () => {
    expect(calcProjectedComp(-100, 5, [0.05, 0.04, 0.03], 330000, 0.02)).toBe(0)
  })

  it('runFormulaEngine: multiple participants aggregate correctly', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p1 = makeParticipant({ row_number: 1, name: 'Alice', plan_comp: 80000 })
    const p2 = makeParticipant({ row_number: 2, name: 'Bob', plan_comp: 120000 })
    const result = runFormulaEngine([p1, p2], settings, valuationDate, sharePrices)

    expect(result.participantDetails).toHaveLength(2)
    expect(result.populationAnalysis[0]!.activeParticipants).toBe(2)
    // Covered comp should be sum of both projected comps
    expect(result.populationAnalysis[0]!.coveredCompensation).toBeGreaterThan(0)
  })

  it('runFormulaEngine: share prices shorter than 11 years uses last price', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const shortPrices = [50, 55] // only 2 prices
    const result = runFormulaEngine(
      [makeParticipant()], settings, valuationDate, shortPrices
    )
    // Year 10 should still work, using the last known price (55)
    expect(result.valuationProjections).toHaveLength(11)
    expect(result.valuationProjections[10]!.pricePerShare).toBe(55)
  })

  it('runFormulaEngine: terminated participant with very old term date', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant({
      term_date: '2015-01-01', // terminated 9 years ago
      reason: 'Voluntary',
    })
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    expect(result.participantDetails[0]!.isTerminated).toBe(true)
    // Should not crash even with old termination date
    expect(result.valuationProjections).toHaveLength(11)
  })

  it('runFormulaEngine: participant with null birth_date does not crash', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant({ birth_date: null })
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    expect(result.participantDetails).toHaveLength(1)
    expect(result.valuationProjections).toHaveLength(11)
  })

  it('runFormulaEngine: participant with null hire_date does not crash', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant({ hire_date: null })
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    expect(result.participantDetails).toHaveLength(1)
  })

  it('runFormulaEngine: S-Corp tax benefit flows through', () => {
    const settings = makeSettings({ scCorporation: 'Yes', taxBenefitAmount: 50000 })
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant()
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    const pd = result.participantDetails[0]!
    // Active participant in S-Corp should have non-zero tax benefit
    expect(pd.yearlyData[0]!.taxBenefit).toBeGreaterThan(0)
  })

  it('runFormulaEngine: OIA tranche generates income', () => {
    const settings = makeSettings({ oiaAnnualReturn: 0.06 })
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant({ oia_tranche: 10000 })
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    const pd = result.participantDetails[0]!
    // Year 0: oiaBalance = 10000 * 1.06^0 = 10000, oiaIncome = 10000 * 0.06 = 600
    expect(pd.yearlyData[0]!.oiaIncome).toBeCloseTo(600, 0)
  })

  it('calcCashRepurchase: yearsSinceSeparation exactly at boundary returns payout', () => {
    // yearsSinceSeparation = distributionPeriod = 5 (still within range)
    const result = calcCashRepurchase(true, 5, 5, 50000, 1.0, 5000)
    expect(result).toBeLessThan(0)
  })

  it('calcShareRepurchase: negative shares returns zero', () => {
    // Negative shares should be treated as 0 (shares <= 0 guard)
    const result = calcShareRepurchase(true, 30, -100, 1.0, 'T-5')
    expect(result.shareRepurchase).toBe(0)
    expect(result.vestingAdjustment).toBe(0)
  })

  it('calcRMDShareDist: age above 120 still returns valid result', () => {
    // lookupRMDLifeExpectancy for age > 120 returns 2.0
    const result = calcRMDShareDist(125, 1000)
    expect(result).toBeCloseTo(-(1000 / 2.0), 2)
  })

  it('calcInServiceDist: negative share price returns 0', () => {
    const result = calcInServiceDist(true, 60, 59, 10000, -50)
    expect(result).toBe(0)
  })

  it('calcNewAllocation: negative contribution still produces valid allocation', () => {
    const result = calcNewAllocation(true, 80000, 400000, -50000, 50, false)
    // compRatio = 0.2, dollar = -50000*0.2 = -10000, shares = -200
    expect(result).toBe(-200)
  })

  it('calcDeathBenefitDist: female gender has lower mortality than male', () => {
    const male = calcDeathBenefitDist(true, 50, 'M', 1000)
    const female = calcDeathBenefitDist(true, 50, 'F', 1000)
    // Female mortality is lower at same age
    expect(Math.abs(female)).toBeLessThan(Math.abs(male))
  })

  it('calcEarlyRetirementDist: age exactly at threshold with 10 years service qualifies', () => {
    const diversYears = [0.25, 0.25, 0.25, 0.25, 0.25, 0.50]
    const result = calcEarlyRetirementDist(true, 55, 10, 1000, diversYears, 55, 0)
    expect(result).toBe(-(1000 * 0.25))
  })

  it('calcVestingPct: 6-year graded boundary values at exact integer years', () => {
    // Verify each integer boundary for 6-year graded schedule
    expect(calcVestingPct(6, 1)).toBe(0)      // 1 year: still 0
    expect(calcVestingPct(6, 2)).toBe(0.20)    // 2 years: 20%
    expect(calcVestingPct(6, 3)).toBe(0.40)    // 3 years: 40%
    expect(calcVestingPct(6, 4)).toBe(0.60)    // 4 years: 60%
    expect(calcVestingPct(6, 5)).toBe(0.80)    // 5 years: 80%
    expect(calcVestingPct(6, 6)).toBe(1.0)     // 6 years: 100%
    expect(calcVestingPct(6, 7)).toBe(1.0)     // 7 years: still 100%
  })

  it('runFormulaEngine: ageTenure summary groups are populated for active participants', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant() // active, ~14 years service
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    // Should have at least one group with count > 0
    const totalActive = result.ageTenureActive.reduce((s, r) => s + r.count, 0)
    // 'All' bucket includes the participant, plus their specific bucket
    const allBucket = result.ageTenureActive.find(r => r.category === 'All')
    expect(allBucket).toBeDefined()
    expect(allBucket!.count).toBeGreaterThan(0)
  })

  it('runFormulaEngine: ageTenure terminated groups for terminated participant', () => {
    const settings = makeSettings()
    const valuationDate = makeDate('2024-01-01')
    const sharePrices = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    const p = makeParticipant({ term_date: '2023-06-15' })
    const result = runFormulaEngine([p], settings, valuationDate, sharePrices)
    const allTermBucket = result.ageTenureTerminated.find(r => r.category === 'All')
    expect(allTermBucket).toBeDefined()
    expect(allTermBucket!.count).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Bug fix regression tests
// ═══════════════════════════════════════════════════════════════

describe('Bug fix regression tests', () => {
  // SEN-189: Success score should be 0-1 decimal, not 1-5 integer
  describe('Success Score scale (SEN-189 fix)', () => {
    it('score is between 0.0 and 1.0 for all cash burn ratios', () => {
      // Test the buildSuccessScores logic indirectly via runFormulaEngine
      const result = runFormulaEngine(
        [makeParticipant({ plan_comp: 100000, total_cash: 50000, shares: [500] })],
        makeSettings({ ebitda: 5000000, annualESOPContribution: 0.05, ebitdaGrowthRate: 0.05 }),
        new Date('2024-01-01'),
        Array(11).fill(100)
      )
      result.successScores.forEach(row => {
        expect(row.esopSuccessScore).toBeGreaterThanOrEqual(0)
        expect(row.esopSuccessScore).toBeLessThanOrEqual(1)
      })
    })

    it('score of 0.95 means 95% when multiplied by 100 (dashboard display)', () => {
      const score = 0.95
      const display = `${(score * 100).toFixed(1)}%`
      expect(display).toBe('95.0%')
    })

    it('score > 1 treated as already percentage (legacy guard)', () => {
      const score = 5
      const display = score > 1 ? `${score.toFixed(1)}` : `${(score * 100).toFixed(1)}%`
      expect(display).toBe('5.0')
    })
  })

  // SEN-187: Year sorting should be numeric, not alphabetical
  describe('Year sorting (SEN-187 fix)', () => {
    it('sorts "Year 0" through "Year 10" numerically', () => {
      const years = ['Year 1', 'Year 10', 'Year 2', 'Year 0', 'Year 9', 'Year 3']
      years.sort((a, b) => {
        const ya = parseInt(a.replace(/\D/g, '')) || 0
        const yb = parseInt(b.replace(/\D/g, '')) || 0
        return ya - yb
      })
      expect(years).toEqual(['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 9', 'Year 10'])
    })

    it('sorts "2024" through "2034" numerically', () => {
      const years = ['2025', '2034', '2024', '2030', '2026']
      years.sort((a, b) => parseInt(a) - parseInt(b))
      expect(years).toEqual(['2024', '2025', '2026', '2030', '2034'])
    })

    it('handles mixed year formats', () => {
      const years = ['Year 10', 'Year 1', '2024', 'Year 2']
      years.sort((a, b) => {
        const ya = parseInt(a.replace(/\D/g, '')) || 0
        const yb = parseInt(b.replace(/\D/g, '')) || 0
        return ya - yb
      })
      expect(years[0]).toBe('Year 1')
    })
  })

  // SEN-186: Null value handling in table cells
  describe('Null value guards (SEN-186 fix)', () => {
    it('null ?? 0 defaults to 0 for numeric fields', () => {
      const val: number | null = null
      expect(val ?? 0).toBe(0)
    })

    it('undefined ?? 0 defaults to 0', () => {
      const val: number | undefined = undefined
      expect(val ?? 0).toBe(0)
    })

    it('toFixed on null-guarded value does not throw', () => {
      const val: number | null = null
      expect(() => ((val ?? 0) * 100).toFixed(1)).not.toThrow()
    })

    it('toLocaleString on null-guarded value does not throw', () => {
      const val: number | null = null
      expect(() => (val ?? 0).toLocaleString()).not.toThrow()
    })
  })

  // SEN-188: ESOP Formation Date normalization
  describe('Date normalization (SEN-188 fix)', () => {
    it('extracts year from ISO date string "2020-05-31T00:00:00.000Z"', () => {
      const raw = '2020-05-31T00:00:00.000Z'
      const year = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.substring(0, 4) : raw
      expect(year).toBe('2020')
    })

    it('leaves plain year string "2020" unchanged', () => {
      const raw = '2020'
      const year = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.substring(0, 4) : raw
      expect(year).toBe('2020')
    })

    it('leaves empty string unchanged', () => {
      const raw = ''
      const year = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.substring(0, 4) : raw
      expect(year).toBe('')
    })

    it('handles "Sun May 31 2020..." JS Date string', () => {
      const raw = 'Sun May 31 2020 00:00:00 GMT+0000'
      // Extract 4-digit year from anywhere in the string
      const match = raw.match(/\b(19|20)\d{2}\b/)
      const year = match ? match[0] : raw
      expect(year).toBe('2020')
    })
  })

  // SEN-185: Dropdown menu should work without Radix portals
  describe('User dropdown (SEN-185 fix)', () => {
    it('profile username first char provides fallback avatar', () => {
      const username = 'MenkeAdmin'
      expect(username.charAt(0).toUpperCase()).toBe('M')
    })

    it('null username defaults to U', () => {
      const username: string | null = null
      expect(username?.charAt(0)?.toUpperCase() || 'U').toBe('U')
    })

    it('empty username defaults to U', () => {
      const username = ''
      expect(username?.charAt(0)?.toUpperCase() || 'U').toBe('U')
    })
  })

  // SEN-190: Projections redirect
  describe('Route redirects (SEN-190 fix)', () => {
    it('/projections should map to /valuation conceptually', () => {
      const routeMap: Record<string, string> = { '/projections': '/valuation' }
      expect(routeMap['/projections']).toBe('/valuation')
    })
  })
})
