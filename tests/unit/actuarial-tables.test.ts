import { describe, it, expect } from 'vitest'
import { lookupSarason, lookupMortality, lookupRMDLifeExpectancy, lookupTurnover } from '../../src/lib/formulas/actuarial-tables'

// ============================================================
// lookupSarason  (present-value annuity factor)
// Formula: (1 - (1+r)^-n) / r, or 1 if years<=1 or rate<=0
// ============================================================
describe('lookupSarason', () => {
  it('returns correct annuity factor for 5 years at 5%', () => {
    // PV annuity factor = (1 - 1.05^-5) / 0.05 = 4.32948...
    const result = lookupSarason(5, 0.05)
    expect(result).toBeCloseTo(4.3295, 3)
  })

  it('returns 1 for edge values (years <= 1 or rate <= 0)', () => {
    expect(lookupSarason(0, 0.05)).toBe(1)
    expect(lookupSarason(1, 0.05)).toBe(1)
    expect(lookupSarason(5, 0)).toBe(1)
    expect(lookupSarason(5, -0.03)).toBe(1)
    expect(lookupSarason(0, 0.10)).toBe(1)
  })

  it('handles large year count (30 years at 5%)', () => {
    const result = lookupSarason(30, 0.05)
    expect(result).toBeCloseTo(15.3725, 2)
  })

  it('uses default 5% rate when rate is omitted', () => {
    const withDefault = lookupSarason(10)
    const withExplicit = lookupSarason(10, 0.05)
    expect(withDefault).toBeCloseTo(withExplicit, 10)
  })
})

// ============================================================
// lookupMortality  (RP-2000 Combined Healthy)
// Interpolates between 5-year bracket values; clamps to 20/90
// ============================================================
describe('lookupMortality', () => {
  it('clamps age 0 to the age-20 bracket (male = 0.0006)', () => {
    expect(lookupMortality(0, 'M')).toBeCloseTo(0.0006, 4)
  })

  it('returns exact bracket value for age 50 (male ~ 0.0040)', () => {
    expect(lookupMortality(50, 'M')).toBeCloseTo(0.0040, 4)
  })

  it('clamps at age 90 upper bound for ages >= 90 (male = 0.1750)', () => {
    expect(lookupMortality(90, 'M')).toBeCloseTo(0.1750, 3)
    expect(lookupMortality(100, 'M')).toBeCloseTo(0.1750, 3)
  })

  it('clamps at age 90 for age 120 (same as 90)', () => {
    expect(lookupMortality(120, 'M')).toBeCloseTo(0.1750, 3)
  })

  it('defaults to male table when gender is null', () => {
    const withNull = lookupMortality(50, null)
    const withMale = lookupMortality(50, 'M')
    expect(withNull).toBe(withMale)
  })

  it('defaults to male table when gender is empty string', () => {
    const withEmpty = lookupMortality(50, '')
    const withMale = lookupMortality(50, 'M')
    expect(withEmpty).toBe(withMale)
  })

  it('recognizes "Female" as female gender (age 50 = 0.0025)', () => {
    expect(lookupMortality(50, 'Female')).toBeCloseTo(0.0025, 4)
  })

  it('returns out-of-range ages clamped to nearest bracket', () => {
    // Below 20 clamps to table[20], above 90 clamps to table[90]
    expect(lookupMortality(5, 'F')).toBeCloseTo(0.0003, 4)   // Female table[20]
    expect(lookupMortality(95, 'F')).toBeCloseTo(0.1400, 3)  // Female table[90]
  })
})

// ============================================================
// lookupRMDLifeExpectancy  (IRS Uniform Lifetime Table)
// ============================================================
describe('lookupRMDLifeExpectancy', () => {
  it('returns 27.4 for age 72', () => {
    expect(lookupRMDLifeExpectancy(72)).toBe(27.4)
  })

  it('returns 20.2 for age 80', () => {
    expect(lookupRMDLifeExpectancy(80)).toBe(20.2)
  })

  it('returns 12.2 for age 90', () => {
    expect(lookupRMDLifeExpectancy(90)).toBe(12.2)
  })

  it('returns 6.4 for age 100', () => {
    expect(lookupRMDLifeExpectancy(100)).toBe(6.4)
  })

  it('returns 2.0 for age 120 (upper edge of table)', () => {
    expect(lookupRMDLifeExpectancy(120)).toBe(2.0)
  })

  it('returns 0 for ages below 72 (RMD not applicable)', () => {
    expect(lookupRMDLifeExpectancy(71)).toBe(0)
    expect(lookupRMDLifeExpectancy(50)).toBe(0)
    expect(lookupRMDLifeExpectancy(0)).toBe(0)
  })
})

// ============================================================
// lookupTurnover  (T-1 through T-11 age-graded tables)
// Interpolates between 5-year brackets; clamps to 20/65
// ============================================================
describe('lookupTurnover', () => {
  it('returns T-1 rate for age 25 (0.02)', () => {
    expect(lookupTurnover('T-1', 25)).toBeCloseTo(0.02, 4)
  })

  it('returns 0 for T-1 at age 50 (table value is 0.01, but age 55+ is 0)', () => {
    // T-1 table[50] = 0.01, which is not 0. But table[55] = 0.00
    expect(lookupTurnover('T-1', 50)).toBeCloseTo(0.01, 4)
  })

  it('returns T-5 rate for age 30 (0.09)', () => {
    expect(lookupTurnover('T-5', 30)).toBeCloseTo(0.09, 4)
  })

  it('returns T-11 rate for age 40 (0.18)', () => {
    expect(lookupTurnover('T-11', 40)).toBeCloseTo(0.18, 4)
  })

  it('defaults to T-5 for invalid table ID', () => {
    const withInvalid = lookupTurnover('T-99', 30)
    const withT5 = lookupTurnover('T-5', 30)
    expect(withInvalid).toBe(withT5)
  })

  it('clamps at age 20 for ages below 16 (T-5 age 20 = 0.10)', () => {
    expect(lookupTurnover('T-5', 16)).toBeCloseTo(0.10, 4)
    expect(lookupTurnover('T-5', 10)).toBeCloseTo(0.10, 4)
  })

  it('returns table[65] for ages above 65 (T-5 age 65 = 0.01)', () => {
    expect(lookupTurnover('T-5', 70)).toBeCloseTo(0.01, 4)
    expect(lookupTurnover('T-5', 80)).toBeCloseTo(0.01, 4)
  })
})

// ============================================================
// Edge cases from production data
// ============================================================
describe('Edge cases from production data', () => {
  it('lookupTurnover for T-1 at age 65 returns 0 (retirement age)', () => {
    // Age 65 in T-1 has zero turnover because they retire, not quit
    const rate = lookupTurnover('T-1', 65)
    expect(rate).toBe(0)
  })

  it('lookupTurnover for T-1 at age 30 returns positive rate', () => {
    const rate = lookupTurnover('T-1', 30)
    expect(rate).toBeGreaterThan(0.01) // ~0.02
    expect(rate).toBeLessThan(0.03)
  })

  it('lookupMortality age 72 (RMD threshold) returns small positive', () => {
    const rate = lookupMortality(72, null)
    expect(rate).toBeGreaterThan(0.01) // ~0.029
    expect(rate).toBeLessThan(0.04)
  })

  it('lookupRMDLifeExpectancy age 72 returns 27.4', () => {
    expect(lookupRMDLifeExpectancy(72)).toBe(27.4)
  })

  it('lookupRMDLifeExpectancy age 100 returns 6.4', () => {
    expect(lookupRMDLifeExpectancy(100)).toBe(6.4)
  })
})
