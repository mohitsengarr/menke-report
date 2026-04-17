/**
 * Actuarial lookup tables used by the ESOP formula engine.
 *
 * - Sarason factors: present-value annuity factors for installment distributions.
 * - Mortality rates: probability of death by age/gender (RP-2000 Combined).
 * - RMD life expectancy: IRS Uniform Lifetime Table for Required Minimum Distributions.
 * - Turnover rates: T-1 through T-11 age-graded voluntary turnover tables.
 */

// Sarason present-value annuity factor: (1 - (1+r)^-n) / r
export function lookupSarason(years: number, rate: number = 0.05): number {
  if (years <= 1 || rate <= 0) return 1
  return (1 - Math.pow(1 + rate, -years)) / rate
}

// RP-2000 Combined Healthy mortality (simplified 5-year brackets)
const MORTALITY_MALE: Record<number, number> = {
  20: 0.0006, 25: 0.0008, 30: 0.0009, 35: 0.0011, 40: 0.0016,
  45: 0.0025, 50: 0.0040, 55: 0.0062, 60: 0.0095, 65: 0.0148,
  70: 0.0234, 75: 0.0379, 80: 0.0628, 85: 0.1050, 90: 0.1750,
}
const MORTALITY_FEMALE: Record<number, number> = {
  20: 0.0003, 25: 0.0004, 30: 0.0005, 35: 0.0007, 40: 0.0010,
  45: 0.0016, 50: 0.0025, 55: 0.0038, 60: 0.0058, 65: 0.0092,
  70: 0.0149, 75: 0.0248, 80: 0.0430, 85: 0.0770, 90: 0.1400,
}

export function lookupMortality(age: number, gender: string | null): number {
  const table = (gender || '').toUpperCase().startsWith('F')
    ? MORTALITY_FEMALE : MORTALITY_MALE
  if (age <= 20) return table[20]!
  if (age >= 90) return table[90]!
  const lower = Math.floor(age / 5) * 5
  const upper = lower + 5
  const frac = (age - lower) / 5
  return (table[lower] ?? table[20]!) + frac * ((table[upper] ?? table[90]!) - (table[lower] ?? table[20]!))
}

// IRS Uniform Lifetime Table for RMD
const RMD_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7,
  77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4,
  82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
  92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0,
  102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
  107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
  112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9,
  116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}

export function lookupRMDLifeExpectancy(age: number): number {
  if (age < 72) return 0
  if (age > 120) return 2.0
  return RMD_TABLE[age] ?? 2.0
}

// Turnover tables T-1 (low) through T-11 (high)
const TURNOVER_TABLES: Record<string, Record<number, number>> = {
  'T-1':  { 20:0.02, 25:0.02, 30:0.02, 35:0.01, 40:0.01, 45:0.01, 50:0.01, 55:0.00, 60:0.00, 65:0.00 },
  'T-2':  { 20:0.04, 25:0.04, 30:0.03, 35:0.03, 40:0.02, 45:0.02, 50:0.01, 55:0.01, 60:0.00, 65:0.00 },
  'T-3':  { 20:0.06, 25:0.06, 30:0.05, 35:0.04, 40:0.03, 45:0.03, 50:0.02, 55:0.01, 60:0.01, 65:0.00 },
  'T-4':  { 20:0.08, 25:0.08, 30:0.07, 35:0.06, 40:0.05, 45:0.04, 50:0.03, 55:0.02, 60:0.01, 65:0.00 },
  'T-5':  { 20:0.10, 25:0.10, 30:0.09, 35:0.07, 40:0.06, 45:0.05, 50:0.04, 55:0.03, 60:0.02, 65:0.01 },
  'T-6':  { 20:0.12, 25:0.12, 30:0.10, 35:0.09, 40:0.07, 45:0.06, 50:0.05, 55:0.04, 60:0.03, 65:0.01 },
  'T-7':  { 20:0.15, 25:0.14, 30:0.12, 35:0.10, 40:0.09, 45:0.07, 50:0.06, 55:0.05, 60:0.03, 65:0.02 },
  'T-8':  { 20:0.18, 25:0.17, 30:0.15, 35:0.12, 40:0.10, 45:0.08, 50:0.07, 55:0.05, 60:0.04, 65:0.02 },
  'T-9':  { 20:0.22, 25:0.20, 30:0.18, 35:0.15, 40:0.12, 45:0.10, 50:0.08, 55:0.06, 60:0.05, 65:0.03 },
  'T-10': { 20:0.26, 25:0.24, 30:0.21, 35:0.18, 40:0.15, 45:0.12, 50:0.10, 55:0.08, 60:0.06, 65:0.04 },
  'T-11': { 20:0.30, 25:0.28, 30:0.25, 35:0.21, 40:0.18, 45:0.15, 50:0.12, 55:0.10, 60:0.07, 65:0.05 },
}

export function lookupTurnover(tableId: string, age: number): number {
  const table = TURNOVER_TABLES[tableId] ?? TURNOVER_TABLES['T-5']!
  if (age <= 20) return table[20]!
  if (age >= 65) return table[65]!
  const lower = Math.floor(age / 5) * 5
  const upper = lower + 5
  const frac = (age - lower) / 5
  return (table[lower] ?? table[20]!) + frac * ((table[upper] ?? table[65]!) - (table[lower] ?? table[20]!))
}
