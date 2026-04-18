import { describe, it, expect } from 'vitest'
import { fmtPct, fmtDollar, fmtDollarCompact, fmtNumber } from '../../src/lib/utils'

/**
 * SEN-225: ensure percentage values stored as ratios render as
 * human-readable percents (e.g. 0.05 → "5.00%"), never as raw decimals.
 */

describe('fmtPct', () => {
  it('0.05 as ratio → "5.00%"', () => {
    expect(fmtPct(0.05)).toBe('5.00%')
  })
  it('0.123 → "12.30%"', () => {
    expect(fmtPct(0.123)).toBe('12.30%')
  })
  it('already-scaled 5 → "5.00%"', () => {
    expect(fmtPct(5)).toBe('5.00%')
  })
  it('already-scaled 150 → "150.00%"', () => {
    expect(fmtPct(150)).toBe('150.00%')
  })
  it('0 → "0.00%"', () => {
    expect(fmtPct(0)).toBe('0.00%')
  })
  it('1 exactly → "100.00%" (treated as ratio)', () => {
    expect(fmtPct(1)).toBe('100.00%')
  })
  it('-0.05 → "-5.00%" (negative ratio)', () => {
    expect(fmtPct(-0.05)).toBe('-5.00%')
  })
  it('null → "—"', () => {
    expect(fmtPct(null)).toBe('—')
  })
  it('undefined → "—"', () => {
    expect(fmtPct(undefined)).toBe('—')
  })
  it('NaN → "—"', () => {
    expect(fmtPct(NaN)).toBe('—')
  })
  it('Infinity → "—"', () => {
    expect(fmtPct(Infinity)).toBe('—')
  })
  it('custom decimals: 0.0567 with 1 → "5.7%"', () => {
    expect(fmtPct(0.0567, 1)).toBe('5.7%')
  })
  it('custom decimals: 0.123456 with 3 → "12.346%"', () => {
    expect(fmtPct(0.123456, 3)).toBe('12.346%')
  })
  it('custom decimals: 0 → "0%" with 0 decimals', () => {
    expect(fmtPct(0.05, 0)).toBe('5%')
  })
})

describe('fmtDollar', () => {
  it('1234567 → "$1,234,567"', () => {
    expect(fmtDollar(1234567)).toBe('$1,234,567')
  })
  it('1234.56 with 2 decimals → "$1,234.56"', () => {
    expect(fmtDollar(1234.56, 2)).toBe('$1,234.56')
  })
  it('0 → "$0"', () => {
    expect(fmtDollar(0)).toBe('$0')
  })
  it('null → "—"', () => {
    expect(fmtDollar(null)).toBe('—')
  })
  it('negative → prepends minus via locale', () => {
    expect(fmtDollar(-500)).toBe('$-500')
  })
  it('NaN → "—"', () => {
    expect(fmtDollar(NaN)).toBe('—')
  })
})

describe('fmtDollarCompact', () => {
  it('1,500,000 → "$1.5M"', () => {
    expect(fmtDollarCompact(1500000)).toBe('$1.5M')
  })
  it('4,500 → "$4.5K"', () => {
    expect(fmtDollarCompact(4500)).toBe('$4.5K')
  })
  it('800 → "$800"', () => {
    expect(fmtDollarCompact(800)).toBe('$800')
  })
  it('0 → "$0"', () => {
    expect(fmtDollarCompact(0)).toBe('$0')
  })
  it('null → "—"', () => {
    expect(fmtDollarCompact(null)).toBe('—')
  })
  it('negative 1.5M → "$-1.5M"', () => {
    expect(fmtDollarCompact(-1500000)).toBe('$-1.5M')
  })
  it('boundary at 1M → "$1.0M"', () => {
    expect(fmtDollarCompact(1000000)).toBe('$1.0M')
  })
  it('boundary at 1K → "$1.0K"', () => {
    expect(fmtDollarCompact(1000)).toBe('$1.0K')
  })
})

describe('fmtNumber', () => {
  it('12345.6 rounded to 0 decimals → "12,346"', () => {
    expect(fmtNumber(12345.6, 0)).toBe('12,346')
  })
  it('0.5 with 1 decimal → "0.5"', () => {
    expect(fmtNumber(0.5, 1)).toBe('0.5')
  })
  it('null → "—"', () => {
    expect(fmtNumber(null)).toBe('—')
  })
  it('1000000 → "1,000,000"', () => {
    expect(fmtNumber(1000000)).toBe('1,000,000')
  })
})

describe('SEN-225 — real-world usage patterns', () => {
  it('effective_benefit_rate typical value 0.023 → "2.3%"', () => {
    expect(fmtPct(0.023, 1)).toBe('2.3%')
  })
  it('ro_cash_burn typical value 0.75 → "75.0%"', () => {
    expect(fmtPct(0.75, 1)).toBe('75.0%')
  })
  it('pct_esop_shares typical value 0.30 → "30.0%"', () => {
    expect(fmtPct(0.30, 1)).toBe('30.0%')
  })
  it('share_price_change typical value -0.045 → "-4.5%"', () => {
    expect(fmtPct(-0.045, 1)).toBe('-4.5%')
  })
  it('esop_success_score with new 0-1 scale 0.95 → "95.0%"', () => {
    expect(fmtPct(0.95, 1)).toBe('95.0%')
  })
  it('legacy row with already-scaled score 95 → "95.0%"', () => {
    expect(fmtPct(95, 1)).toBe('95.0%')
  })
})
