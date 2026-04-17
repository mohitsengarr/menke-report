import { describe, it, expect } from 'vitest'
import {
  parseDate, yearsBetween, ageAt, addYears, yearDate,
  calcSeparationDate, calcVestingPct, calcProjectedComp,
  calcCashRepurchase, calcShareRepurchase, calcEarlyRetirementDist,
  calcDeathBenefitDist, calcRMDShareDist, calcInServiceDist,
  calcNewAllocation, calcOIAIncome, runFormulaEngine,
  type ParticipantInput, type PlanSettings,
} from '../../src/lib/formulas/engine'
import type { FormulaConfigOverride, ResolvedConfig } from '../../src/lib/formulas/config'
import { resolveFormulaConfig } from '../../src/lib/formulas/config'

/**
 * Boundary-value tests for every formula engine primitive.
 * Focus: edge cases — 0, negative, max/min thresholds, flip points.
 */

function makeParticipant(overrides: Partial<ParticipantInput> = {}): ParticipantInput {
  return {
    row_number: 1,
    name: 'Boundary Test',
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
// Date helpers
// ═══════════════════════════════════════════════════════════════
describe('parseDate', () => {
  it('returns null for null input', () => {
    expect(parseDate(null)).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })
  it('returns null for invalid date', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })
  it('parses ISO date', () => {
    const d = parseDate('2026-04-17')
    expect(d).toBeInstanceOf(Date)
    expect(d!.getFullYear()).toBe(2026)
  })
  it('parses ISO datetime', () => {
    const d = parseDate('2026-04-17T10:00:00Z')
    expect(d).toBeInstanceOf(Date)
  })
  it('parses date with time', () => {
    const d = parseDate('2026-04-17T10:00:00')
    expect(d).toBeInstanceOf(Date)
  })
})

describe('yearsBetween', () => {
  it('same date → 0', () => {
    expect(yearsBetween(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(0)
  })
  it('one year apart', () => {
    expect(yearsBetween(new Date('2025-01-01'), new Date('2026-01-01'))).toBeCloseTo(1, 1)
  })
  it('later < earlier is negative', () => {
    expect(yearsBetween(new Date('2026-01-01'), new Date('2025-01-01'))).toBeLessThan(0)
  })
  it('fractional year', () => {
    expect(yearsBetween(new Date('2025-01-01'), new Date('2025-07-01'))).toBeCloseTo(0.5, 1)
  })
})

describe('ageAt', () => {
  it('birthday exactly: yearsBetween floored', () => {
    expect(ageAt(new Date('1990-01-01'), new Date('2026-01-01'))).toBe(36)
  })
  it('one day before birthday', () => {
    expect(ageAt(new Date('1990-01-02'), new Date('2026-01-01'))).toBe(35)
  })
  it('same date → 0', () => {
    expect(ageAt(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(0)
  })
  it('birth in future → negative age', () => {
    expect(ageAt(new Date('2030-01-01'), new Date('2026-01-01'))).toBeLessThan(0)
  })
})

describe('addYears', () => {
  it('adds integer years', () => {
    expect(addYears(new Date('2020-01-01'), 5).getFullYear()).toBe(2025)
  })
  it('adds zero returns same year', () => {
    expect(addYears(new Date('2020-06-15'), 0).getFullYear()).toBe(2020)
  })
  it('adds negative years', () => {
    expect(addYears(new Date('2020-01-01'), -3).getFullYear()).toBe(2017)
  })
})

describe('yearDate', () => {
  it('returns date with given offset', () => {
    const base = new Date('2026-01-01')
    expect(yearDate(base, 5).getFullYear()).toBe(2031)
  })
  it('zero offset returns same date', () => {
    const base = new Date('2026-06-15')
    expect(yearDate(base, 0).getFullYear()).toBe(base.getFullYear())
  })
})

// ═══════════════════════════════════════════════════════════════
// calcSeparationDate
// ═══════════════════════════════════════════════════════════════
describe('calcSeparationDate boundaries', () => {
  it('terminated: uses term_date directly', () => {
    const term = new Date('2025-06-01')
    expect(calcSeparationDate(new Date('1970-01-01'), term, 65)).toEqual(term)
  })
  it('not terminated, no DOB: returns null', () => {
    expect(calcSeparationDate(null, null, 65)).toBeNull()
  })
  it('not terminated, with DOB: projects retirement date', () => {
    const result = calcSeparationDate(new Date('1970-01-01'), null, 65)
    expect(result!.getFullYear()).toBe(2035)
  })
  it('different retirementAge changes projected date', () => {
    const result = calcSeparationDate(new Date('1970-01-01'), null, 60)
    expect(result!.getFullYear()).toBe(2030)
  })
  it('retirementAge 0 → returns birth date', () => {
    const result = calcSeparationDate(new Date('1970-01-01'), null, 0)
    expect(result!.getFullYear()).toBe(1970)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcVestingPct boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcVestingPct boundaries — 1-year cliff', () => {
  it('yos=0 → 0', () => {
    expect(calcVestingPct(1, 0)).toBe(0)
  })
  it('yos=0.99 → 0', () => {
    expect(calcVestingPct(1, 0.99)).toBe(0)
  })
  it('yos=1.0 exactly → 1.0', () => {
    expect(calcVestingPct(1, 1.0)).toBe(1.0)
  })
  it('yos=5 → 1.0', () => {
    expect(calcVestingPct(1, 5)).toBe(1.0)
  })
  it('yos negative → 0', () => {
    expect(calcVestingPct(1, -1)).toBe(0)
  })
})

describe('calcVestingPct boundaries — 3-year cliff', () => {
  it('yos=2.99 → 0', () => {
    expect(calcVestingPct(3, 2.99)).toBe(0)
  })
  it('yos=3 → 1.0', () => {
    expect(calcVestingPct(3, 3)).toBe(1.0)
  })
  it('yos=10 → 1.0', () => {
    expect(calcVestingPct(3, 10)).toBe(1.0)
  })
})

describe('calcVestingPct boundaries — 6-year graded', () => {
  it('yos=0 → 0', () => {
    expect(calcVestingPct(6, 0)).toBe(0)
  })
  it('yos=1.99 → 0 (below gradedStart=2)', () => {
    expect(calcVestingPct(6, 1.99)).toBe(0)
  })
  it('yos=2 → 0.20', () => {
    expect(calcVestingPct(6, 2)).toBeCloseTo(0.20, 2)
  })
  it('yos=3 → 0.40', () => {
    expect(calcVestingPct(6, 3)).toBeCloseTo(0.40, 2)
  })
  it('yos=4 → 0.60', () => {
    expect(calcVestingPct(6, 4)).toBeCloseTo(0.60, 2)
  })
  it('yos=5 → 0.80', () => {
    expect(calcVestingPct(6, 5)).toBeCloseTo(0.80, 2)
  })
  it('yos=5.99 → 0.80 (still in step 4)', () => {
    expect(calcVestingPct(6, 5.99)).toBeCloseTo(0.80, 2)
  })
  it('yos=6 exactly → 1.0', () => {
    expect(calcVestingPct(6, 6)).toBe(1.0)
  })
  it('yos=10 → 1.0 (max)', () => {
    expect(calcVestingPct(6, 10)).toBe(1.0)
  })
})

describe('calcVestingPct — config overrides', () => {
  function cfg(overrides: Record<string, number>): ResolvedConfig {
    const baseOverrides: FormulaConfigOverride[] = Object.entries(overrides).map(([k, v]) => ({
      config_key: k, value_number: v, value_text: null, value_json: null,
    }))
    return resolveFormulaConfig(baseOverrides)
  }

  it('override 1yr cliff threshold to 2 → yos=1 is 0', () => {
    const c = cfg({ 'vesting.1yr_cliff_threshold': 2 })
    expect(calcVestingPct(1, 1, c)).toBe(0)
  })
  it('override 1yr cliff threshold to 2 → yos=2 is 100%', () => {
    const c = cfg({ 'vesting.1yr_cliff_threshold': 2 })
    expect(calcVestingPct(1, 2, c)).toBe(1.0)
  })
  it('override 3yr cliff threshold to 5 → yos=4 is 0', () => {
    const c = cfg({ 'vesting.3yr_cliff_threshold': 5 })
    expect(calcVestingPct(3, 4, c)).toBe(0)
  })
  it('override 3yr cliff threshold to 5 → yos=5 is 100%', () => {
    const c = cfg({ 'vesting.3yr_cliff_threshold': 5 })
    expect(calcVestingPct(3, 5, c)).toBe(1.0)
  })
  it('override graded step to 0.10 → yos=3 is 20%', () => {
    const c = cfg({ 'vesting.6yr_graded_step': 0.10 })
    expect(calcVestingPct(6, 3, c)).toBeCloseTo(0.20, 2)
  })
  it('override graded start to 1 → yos=1 is 20%', () => {
    const c = cfg({ 'vesting.6yr_graded_start': 1 })
    expect(calcVestingPct(6, 1, c)).toBeCloseTo(0.20, 2)
  })
  it('override graded full year to 4 → yos=4 is 100%', () => {
    const c = cfg({ 'vesting.6yr_graded_full_year': 4 })
    expect(calcVestingPct(6, 4, c)).toBe(1.0)
  })
  it('no config argument → uses hardcoded defaults', () => {
    expect(calcVestingPct(6, 2)).toBeCloseTo(0.20, 2)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcProjectedComp boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcProjectedComp boundaries', () => {
  it('base 0 → returns 0', () => {
    expect(calcProjectedComp(0, 5, [0.05, 0.04, 0.03], 330000, 0.02)).toBe(0)
  })
  it('base negative → returns 0', () => {
    expect(calcProjectedComp(-100, 5, [0.05, 0.04, 0.03], 330000, 0.02)).toBe(0)
  })
  it('yearOffset 0 → returns base', () => {
    expect(calcProjectedComp(50000, 0, [0.05, 0.04, 0.03], 330000, 0.02)).toBe(50000)
  })
  it('yearOffset 1 → applies year-0-1 growth', () => {
    expect(calcProjectedComp(50000, 1, [0.05, 0.04, 0.03], 330000, 0.02)).toBeCloseTo(52500, 0)
  })
  it('capped at compLimit', () => {
    const high = calcProjectedComp(500000, 0, [0, 0, 0], 330000, 0.02)
    expect(high).toBeLessThanOrEqual(330000)
  })
  it('compLimit grows each year with compLimitIncrease', () => {
    const yr5 = calcProjectedComp(500000, 5, [0, 0, 0], 330000, 0.02)
    expect(yr5).toBeGreaterThan(330000)
  })
  it('0 growth rate → returns base (capped)', () => {
    expect(calcProjectedComp(50000, 10, [0, 0, 0], 330000, 0)).toBe(50000)
  })
  it('high growth rate (25%) accumulates', () => {
    const high = calcProjectedComp(50000, 3, [0.25, 0.25, 0.25], 1e9, 0)
    expect(high).toBeCloseTo(50000 * 1.25 * 1.25 * 1.25, 0)
  })
  it('year 5 uses tier-2 growth (years 2-5)', () => {
    const yr5 = calcProjectedComp(50000, 5, [0, 0.10, 0], 1e9, 0)
    // Year 1 uses rate[0]=0, years 2-5 use rate[1]=0.10 (4 compounds)
    expect(yr5).toBeCloseTo(50000 * Math.pow(1.10, 4), 0)
  })
  it('year 6+ uses tier-3 growth', () => {
    const yr6 = calcProjectedComp(50000, 6, [0, 0, 0.10], 1e9, 0)
    // Year 1: 0, Years 2-5: 0, Year 6: 0.10 (1 compound)
    expect(yr6).toBeCloseTo(50000 * 1.10, 0)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcCashRepurchase boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcCashRepurchase boundaries', () => {
  it('not terminated → 0', () => {
    expect(calcCashRepurchase(false, 2, 5, 10000, 1, 5000)).toBe(0)
  })
  it('yearsSinceSep < 1 → 0', () => {
    expect(calcCashRepurchase(true, 0.5, 5, 10000, 1, 5000)).toBe(0)
  })
  it('yearsSinceSep > distributionPeriod → 0', () => {
    expect(calcCashRepurchase(true, 6, 5, 10000, 1, 5000)).toBe(0)
  })
  it('vestedValue below lumpSumLimit in year 1 → full lump', () => {
    expect(calcCashRepurchase(true, 1, 5, 4000, 1, 5000)).toBe(-4000)
  })
  it('vestedValue just above lumpSumLimit → amortized', () => {
    const v = calcCashRepurchase(true, 1, 5, 5001, 1, 5000)
    expect(v).not.toBe(-5001) // amortized, not lump
    expect(v).toBeLessThan(0)
  })
  it('vestingPct=0 → 0 (nothing vested)', () => {
    expect(Math.abs(calcCashRepurchase(true, 1, 5, 10000, 0, 5000))).toBe(0)
  })
  it('distributionPeriod=1 → single payout', () => {
    const v = calcCashRepurchase(true, 1, 1, 10000, 1, 5000)
    expect(v).toBeLessThan(0)
  })
  it('vestingPct=0.5 halves the vested amount', () => {
    const full = calcCashRepurchase(true, 1, 5, 10000, 1.0, 0)
    const half = calcCashRepurchase(true, 1, 5, 10000, 0.5, 0)
    expect(Math.abs(half)).toBeCloseTo(Math.abs(full) / 2, 0)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcShareRepurchase boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcShareRepurchase boundaries', () => {
  it('inactive → zeros', () => {
    expect(calcShareRepurchase(false, 40, 1000, 1, 'T-5'))
      .toEqual({ shareRepurchase: 0, vestingAdjustment: 0 })
  })
  it('0 shares → zeros', () => {
    expect(calcShareRepurchase(true, 40, 0, 1, 'T-5'))
      .toEqual({ shareRepurchase: 0, vestingAdjustment: 0 })
  })
  it('T-1 produces less turnover than T-11', () => {
    const t1 = calcShareRepurchase(true, 30, 1000, 1, 'T-1').shareRepurchase
    const t11 = calcShareRepurchase(true, 30, 1000, 1, 'T-11').shareRepurchase
    expect(Math.abs(t1)).toBeLessThan(Math.abs(t11))
  })
  it('vestingPct=0 → all vesting adjustment, no share repurchase', () => {
    const { shareRepurchase, vestingAdjustment } = calcShareRepurchase(true, 40, 1000, 0, 'T-5')
    expect(Math.abs(shareRepurchase)).toBe(0)
    expect(vestingAdjustment).toBeLessThan(0)
  })
  it('vestingPct=1 → all share repurchase, 0 vesting adjustment', () => {
    const { shareRepurchase, vestingAdjustment } = calcShareRepurchase(true, 40, 1000, 1, 'T-5')
    expect(shareRepurchase).toBeLessThan(0)
    expect(Math.abs(vestingAdjustment)).toBe(0)
  })
  it('vestingPct=0.5 splits evenly', () => {
    const { shareRepurchase, vestingAdjustment } = calcShareRepurchase(true, 40, 1000, 0.5, 'T-5')
    expect(Math.abs(shareRepurchase)).toBeCloseTo(Math.abs(vestingAdjustment), 2)
  })
  it('invalid turnover table → falls back to T-5', () => {
    const invalid = calcShareRepurchase(true, 40, 1000, 1, 'T-99').shareRepurchase
    const valid = calcShareRepurchase(true, 40, 1000, 1, 'T-5').shareRepurchase
    expect(invalid).toBeCloseTo(valid, 2)
  })
  it('age below 20 clamps to age 20 lookup', () => {
    const young = calcShareRepurchase(true, 18, 1000, 1, 'T-5').shareRepurchase
    const age20 = calcShareRepurchase(true, 20, 1000, 1, 'T-5').shareRepurchase
    expect(young).toBeCloseTo(age20, 2)
  })
  it('age above 65 clamps to age 65 lookup', () => {
    const old = calcShareRepurchase(true, 80, 1000, 1, 'T-5').shareRepurchase
    const age65 = calcShareRepurchase(true, 65, 1000, 1, 'T-5').shareRepurchase
    expect(old).toBeCloseTo(age65, 2)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcEarlyRetirementDist boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcEarlyRetirementDist boundaries', () => {
  const diversYears = [0.25, 0.25, 0.25, 0.25, 0.25, 0.50]

  it('inactive → 0', () => {
    expect(calcEarlyRetirementDist(false, 56, 15, 1000, diversYears, 55, 0)).toBe(0)
  })
  it('age below threshold → 0', () => {
    expect(calcEarlyRetirementDist(true, 54, 15, 1000, diversYears, 55, 0)).toBe(0)
  })
  it('service below 10 → 0', () => {
    expect(calcEarlyRetirementDist(true, 60, 9, 1000, diversYears, 55, 0)).toBe(0)
  })
  it('window index < 0 → 0', () => {
    expect(calcEarlyRetirementDist(true, 56, 15, 1000, diversYears, 55, -1)).toBe(0)
  })
  it('window index beyond array → 0', () => {
    expect(calcEarlyRetirementDist(true, 56, 15, 1000, diversYears, 55, 6)).toBe(0)
  })
  it('valid window: returns -(shares × pct)', () => {
    expect(calcEarlyRetirementDist(true, 56, 15, 1000, diversYears, 55, 0)).toBe(-250)
  })
  it('final window index 5 returns 50% distribution', () => {
    expect(calcEarlyRetirementDist(true, 56, 15, 1000, diversYears, 55, 5)).toBe(-500)
  })
  it('service requirement override=5 → yos=6 now eligible', () => {
    const c = resolveFormulaConfig([
      { config_key: 'age.diversification_service_requirement', value_number: 5, value_text: null, value_json: null },
    ])
    expect(calcEarlyRetirementDist(true, 56, 6, 1000, diversYears, 55, 0, c)).toBe(-250)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcDeathBenefitDist & calcRMDShareDist boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcDeathBenefitDist boundaries', () => {
  it('inactive → 0', () => {
    expect(calcDeathBenefitDist(false, 50, 'M', 1000)).toBe(0)
  })
  it('0 shares → 0', () => {
    expect(calcDeathBenefitDist(true, 50, 'M', 0)).toBe(0)
  })
  it('age 50 male has higher mortality than female', () => {
    const m = calcDeathBenefitDist(true, 50, 'M', 1000)
    const f = calcDeathBenefitDist(true, 50, 'F', 1000)
    expect(Math.abs(m)).toBeGreaterThan(Math.abs(f))
  })
  it('mortality grows with age', () => {
    const y = Math.abs(calcDeathBenefitDist(true, 30, 'M', 1000))
    const o = Math.abs(calcDeathBenefitDist(true, 70, 'M', 1000))
    expect(o).toBeGreaterThan(y)
  })
  it('age clamp at 90 (no extrapolation)', () => {
    const a90 = calcDeathBenefitDist(true, 90, 'M', 1000)
    const a100 = calcDeathBenefitDist(true, 100, 'M', 1000)
    expect(a90).toBeCloseTo(a100, 0)
  })
})

describe('calcRMDShareDist boundaries', () => {
  it('age 71 → 0', () => {
    expect(calcRMDShareDist(71, 1000)).toBe(0)
  })
  it('age 72 → triggers', () => {
    expect(calcRMDShareDist(72, 1000)).toBeLessThan(0)
  })
  it('age 120 → uses edge value', () => {
    expect(calcRMDShareDist(120, 1000)).toBeLessThan(0)
  })
  it('age 125 → still uses clamped table value', () => {
    expect(calcRMDShareDist(125, 1000)).toBeLessThan(0)
  })
  it('0 shares → 0', () => {
    expect(calcRMDShareDist(75, 0)).toBe(0)
  })
  it('negative age → 0', () => {
    expect(calcRMDShareDist(-5, 1000)).toBe(0)
  })
  it('config override rmdStart=80 → age 72 is 0', () => {
    const c = resolveFormulaConfig([
      { config_key: 'age.rmd_start', value_number: 80, value_text: null, value_json: null },
    ])
    expect(calcRMDShareDist(72, 1000, c)).toBe(0)
  })
  it('SEN-207: config override rmdStart=65 → age 66 produces non-zero RMD', () => {
    const c = resolveFormulaConfig([
      { config_key: 'age.rmd_start', value_number: 65, value_text: null, value_json: null },
    ])
    expect(calcRMDShareDist(66, 1000, c)).toBeLessThan(0)
  })
  it('SEN-207: lookupRMDLifeExpectancy respects rmdStartAge arg', () => {
    // Inferred via engine tests; life-expectancy table now covers ages 50+
    // when the override gate is lowered.
    const c = resolveFormulaConfig([
      { config_key: 'age.rmd_start', value_number: 60, value_text: null, value_json: null },
    ])
    // Age 60 with override=60 → gets RMD
    expect(calcRMDShareDist(60, 1000, c)).toBeLessThan(0)
    // Age 59 with override=60 → below gate → 0
    expect(calcRMDShareDist(59, 1000, c)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcInServiceDist boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcInServiceDist boundaries', () => {
  it('inactive → 0', () => {
    expect(calcInServiceDist(false, 65, 59, 10000, 10)).toBe(0)
  })
  it('age below threshold → 0', () => {
    expect(calcInServiceDist(true, 58, 59, 10000, 10)).toBe(0)
  })
  it('sharePrice = 0 → 0 (divide-by-zero guard)', () => {
    expect(calcInServiceDist(true, 60, 59, 10000, 0)).toBe(0)
  })
  it('normal: -(amount / price)', () => {
    expect(calcInServiceDist(true, 60, 59, 10000, 10)).toBe(-1000)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcNewAllocation boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcNewAllocation boundaries', () => {
  it('frozen plan → 0', () => {
    expect(calcNewAllocation(true, 50000, 1000000, 100000, 10, true)).toBe(0)
  })
  it('inactive → 0', () => {
    expect(calcNewAllocation(false, 50000, 1000000, 100000, 10, false)).toBe(0)
  })
  it('totalCoveredComp=0 → 0', () => {
    expect(calcNewAllocation(true, 50000, 0, 100000, 10, false)).toBe(0)
  })
  it('sharePrice=0 → 0 (divide-by-zero guard)', () => {
    expect(calcNewAllocation(true, 50000, 1000000, 100000, 0, false)).toBe(0)
  })
  it('projectedComp=0 → 0', () => {
    expect(calcNewAllocation(true, 0, 1000000, 100000, 10, false)).toBe(0)
  })
  it('normal: proportional', () => {
    // compRatio = 50000/1000000 = 0.05
    // dollarAllocation = 100000 * 0.05 = 5000
    // shares = 5000 / 10 = 500
    expect(calcNewAllocation(true, 50000, 1000000, 100000, 10, false)).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════
// calcOIAIncome boundaries
// ═══════════════════════════════════════════════════════════════
describe('calcOIAIncome boundaries', () => {
  it('0 balance → 0', () => {
    expect(calcOIAIncome(0, 0.06)).toBe(0)
  })
  it('0 return → 0', () => {
    expect(calcOIAIncome(1000, 0)).toBe(0)
  })
  it('positive × positive: balance × rate', () => {
    expect(calcOIAIncome(1000, 0.06)).toBeCloseTo(60, 2)
  })
  it('negative balance (refund scenario)', () => {
    expect(calcOIAIncome(-1000, 0.06)).toBeCloseTo(-60, 2)
  })
})

// ═══════════════════════════════════════════════════════════════
// runFormulaEngine robustness
// ═══════════════════════════════════════════════════════════════
describe('runFormulaEngine robustness', () => {
  const settings = makeSettings()
  const valDate = new Date('2026-01-01')
  const sharePrices = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15]

  it('0 participants: empty but valid structure', () => {
    const out = runFormulaEngine([], settings, valDate, sharePrices)
    expect(out.valuationProjections.length).toBe(11)
    expect(out.participantDetails.length).toBe(0)
    expect(out.populationAnalysis[0]!.activeParticipants).toBe(0)
  })
  it('1 participant with 0 shares', () => {
    const p = makeParticipant({ shares: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    expect(() => runFormulaEngine([p], settings, valDate, sharePrices)).not.toThrow()
  })
  it('configOverrides=[] identical to omitted arg', () => {
    const p = makeParticipant()
    const a = runFormulaEngine([p], settings, valDate, sharePrices)
    const b = runFormulaEngine([p], settings, valDate, sharePrices, [])
    expect(a.repurchaseObligations[0]!.totalRepurchaseObligation)
      .toBeCloseTo(b.repurchaseObligations[0]!.totalRepurchaseObligation, 2)
  })
  it('returns all 8 output fields', () => {
    const out = runFormulaEngine([makeParticipant()], settings, valDate, sharePrices)
    for (const key of [
      'valuationProjections', 'repurchaseObligations', 'shareTurnover',
      'populationAnalysis', 'successScores', 'ageTenureActive',
      'ageTenureTerminated', 'participantDetails',
    ]) {
      expect(out).toHaveProperty(key)
    }
  })
  it('participantDetails.length = input.length', () => {
    const ps = [makeParticipant({ row_number: 1 }), makeParticipant({ row_number: 2 })]
    const out = runFormulaEngine(ps, settings, valDate, sharePrices)
    expect(out.participantDetails.length).toBe(2)
  })
  it('valuationProjections.length = projection_years override', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'plan.projection_years', value_number: 7, value_text: null, value_json: null },
    ]
    const out = runFormulaEngine([makeParticipant()], settings, valDate, sharePrices, overrides)
    expect(out.valuationProjections.length).toBe(7)
  })
  it('sharePrice array shorter than horizon: engine extends with last price', () => {
    const short = [10, 11, 12]
    const out = runFormulaEngine([makeParticipant()], settings, valDate, short)
    expect(out.valuationProjections[10]!.pricePerShare).toBe(12)
  })
  it('active participants flow through new allocation', () => {
    const p = makeParticipant({ plan_comp: 100000 })
    const out = runFormulaEngine([p], settings, valDate, sharePrices)
    expect(out.participantDetails[0]!.yearlyData[0]!.newAllocation).toBeGreaterThan(0)
  })
  it('totalSharesOutstanding preserved across years', () => {
    const out = runFormulaEngine([makeParticipant()], settings, valDate, sharePrices)
    for (const row of out.valuationProjections) {
      expect(row.totalShares).toBe(settings.totalSharesOutstanding)
    }
  })
  it('pct calculations sum to ~1', () => {
    const out = runFormulaEngine([makeParticipant()], settings, valDate, sharePrices)
    for (const row of out.valuationProjections) {
      expect(row.pctEsopShares + row.pctOtherShares).toBeCloseTo(1, 2)
    }
  })
})
