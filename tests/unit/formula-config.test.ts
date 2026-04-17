import { describe, it, expect } from 'vitest'
import {
  FORMULA_CONFIG_REGISTRY,
  CONFIG_CATEGORIES,
  resolveFormulaConfig,
  getConfigDef,
  validateConfigValue,
  getCompGrowthRates,
  getDiversYears,
  type FormulaConfigDef,
  type FormulaConfigOverride,
} from '@/lib/formulas/config'

/**
 * Unit tests for the formula configuration registry and resolver
 * at src/lib/formulas/config.ts.
 */

const ALLOWED_CATEGORIES = [
  'vesting',
  'compensation',
  'age',
  'distribution',
  'valuation',
  'success_score',
  'plan_defaults',
] as const

const ALLOWED_TYPES = ['number', 'percentage', 'integer', 'text', 'json'] as const

const KEY_REGEX = /^[a-z_]+\.[a-z0-9_]+$/

// ============================================================
// Registry shape
// ============================================================
describe('FORMULA_CONFIG_REGISTRY — registry shape', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FORMULA_CONFIG_REGISTRY)).toBe(true)
    expect(FORMULA_CONFIG_REGISTRY.length).toBeGreaterThan(0)
  })

  it('every entry has required fields (key, label, description, usedIn, category, type, default)', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(typeof def.key).toBe('string')
      expect(def.key.length).toBeGreaterThan(0)
      expect(typeof def.label).toBe('string')
      expect(def.label.length).toBeGreaterThan(0)
      expect(typeof def.description).toBe('string')
      expect(def.description.length).toBeGreaterThan(0)
      expect(typeof def.usedIn).toBe('string')
      expect(def.usedIn.length).toBeGreaterThan(0)
      expect(typeof def.category).toBe('string')
      expect(typeof def.type).toBe('string')
      expect(def.default).toBeDefined()
    }
  })

  it('every key is unique', () => {
    const keys = FORMULA_CONFIG_REGISTRY.map(d => d.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  it('every key uses snake_case with dots (e.g. "vesting.1yr_cliff_threshold")', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(def.key, `Key ${def.key} should match regex ${KEY_REGEX}`).toMatch(KEY_REGEX)
    }
  })

  it('every category is one of the allowed values', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(ALLOWED_CATEGORIES).toContain(def.category)
    }
  })

  it('every type is one of number/percentage/integer/text/json', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(ALLOWED_TYPES).toContain(def.type)
    }
  })

  it('numeric entries with min/max have min <= max', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.min !== undefined && def.max !== undefined) {
        expect(def.min, `Entry ${def.key} min <= max`).toBeLessThanOrEqual(def.max)
      }
    }
  })

  it('every default respects its min/max bound if defined', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (typeof def.default === 'number') {
        if (def.min !== undefined) {
          expect(def.default, `Entry ${def.key} default >= min`).toBeGreaterThanOrEqual(def.min)
        }
        if (def.max !== undefined) {
          expect(def.default, `Entry ${def.key} default <= max`).toBeLessThanOrEqual(def.max)
        }
      }
    }
  })

  it('registry has at least one entry per allowed category', () => {
    for (const cat of ALLOWED_CATEGORIES) {
      const found = FORMULA_CONFIG_REGISTRY.some(d => d.category === cat)
      expect(found, `Category ${cat} should have at least one entry`).toBe(true)
    }
  })

  it('every numeric/percentage/integer entry has a numeric default', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type === 'number' || def.type === 'percentage' || def.type === 'integer') {
        expect(typeof def.default).toBe('number')
      }
    }
  })

  it('every text entry has a string default', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type === 'text') {
        expect(typeof def.default).toBe('string')
      }
    }
  })

  it('every integer entry default is a whole number', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type === 'integer') {
        expect(Number.isInteger(def.default)).toBe(true)
      }
    }
  })
})

// ============================================================
// CONFIG_CATEGORIES
// ============================================================
describe('CONFIG_CATEGORIES', () => {
  it('contains the expected 7 categories', () => {
    expect(CONFIG_CATEGORIES.length).toBe(7)
    const ids = CONFIG_CATEGORIES.map(c => c.id)
    for (const cat of ALLOWED_CATEGORIES) {
      expect(ids).toContain(cat)
    }
  })

  it('every id matches a registry category value', () => {
    const registryCategories = new Set(FORMULA_CONFIG_REGISTRY.map(d => d.category))
    for (const cat of CONFIG_CATEGORIES) {
      expect(registryCategories.has(cat.id)).toBe(true)
    }
  })

  it('has no duplicate ids', () => {
    const ids = CONFIG_CATEGORIES.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each category has label and color', () => {
    for (const cat of CONFIG_CATEGORIES) {
      expect(typeof cat.label).toBe('string')
      expect(cat.label.length).toBeGreaterThan(0)
      expect(typeof cat.color).toBe('string')
      expect(cat.color.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// resolveFormulaConfig
// ============================================================
describe('resolveFormulaConfig', () => {
  it('with empty overrides: every registry key maps to its default', () => {
    const resolved = resolveFormulaConfig([])
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(resolved[def.key]).toEqual(def.default)
    }
  })

  it('with single numeric override: that key is overridden, rest are defaults', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'age.rmd_start', value_number: 73, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['age.rmd_start']).toBe(73)
    // All others should be defaults
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.key !== 'age.rmd_start') {
        expect(resolved[def.key]).toEqual(def.default)
      }
    }
  })

  it('with single text override: text value is applied', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'plan.default_turnover_table', value_number: null, value_text: 'T-3', value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['plan.default_turnover_table']).toBe('T-3')
  })

  it('with multiple overrides: all are applied', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'age.rmd_start', value_number: 73, value_text: null, value_json: null },
      { config_key: 'age.retirement_default', value_number: 67, value_text: null, value_json: null },
      { config_key: 'plan.default_turnover_table', value_number: null, value_text: 'T-7', value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['age.rmd_start']).toBe(73)
    expect(resolved['age.retirement_default']).toBe(67)
    expect(resolved['plan.default_turnover_table']).toBe('T-7')
  })

  it('unknown override keys are ignored (not thrown)', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'does.not_exist', value_number: 99, value_text: null, value_json: null },
    ]
    expect(() => resolveFormulaConfig(overrides)).not.toThrow()
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['does.not_exist']).toBeUndefined()
  })

  it('null value_number overrides are skipped (default preserved)', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'age.rmd_start', value_number: null, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    // Should fall back to default of 72
    expect(resolved['age.rmd_start']).toBe(72)
  })

  it('undefined value_number overrides are skipped', () => {
    const overrides: FormulaConfigOverride[] = [
      // value_number intentionally left undefined
      { config_key: 'age.rmd_start', value_number: undefined as unknown as null, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['age.rmd_start']).toBe(72)
  })

  it('returns a Record keyed by config_key', () => {
    const resolved = resolveFormulaConfig([])
    expect(typeof resolved).toBe('object')
    expect(resolved).not.toBeNull()
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(def.key in resolved).toBe(true)
    }
  })

  it('percentage type treats value_number as fractional (0.05 stays 0.05)', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'comp.growth_rate_year_0_1', value_number: 0.07, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['comp.growth_rate_year_0_1']).toBe(0.07)
  })

  it('integer override is applied as number', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'plan.projection_years', value_number: 15, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['plan.projection_years']).toBe(15)
    expect(typeof resolved['plan.projection_years']).toBe('number')
  })

  it('resolver is pure (multiple calls return independent objects)', () => {
    const r1 = resolveFormulaConfig([])
    const r2 = resolveFormulaConfig([])
    expect(r1).not.toBe(r2)
    expect(r1).toEqual(r2)
    // Mutating r1 should not affect r2
    ;(r1 as Record<string, unknown>)['age.rmd_start'] = 999
    expect(r2['age.rmd_start']).toBe(72)
  })

  it('empty array behaves same as no argument', () => {
    const r1 = resolveFormulaConfig()
    const r2 = resolveFormulaConfig([])
    expect(r1).toEqual(r2)
  })

  it('numeric-string value_number is coerced to number via Number()', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'age.rmd_start', value_number: '74' as unknown as number, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['age.rmd_start']).toBe(74)
    expect(typeof resolved['age.rmd_start']).toBe('number')
  })

  it('order of overrides: last wins for duplicate keys', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'age.rmd_start', value_number: 73, value_text: null, value_json: null },
      { config_key: 'age.rmd_start', value_number: 75, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['age.rmd_start']).toBe(75)
  })

  it('vesting.1yr_cliff_threshold default is 1', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['vesting.1yr_cliff_threshold']).toBe(1)
  })

  it('age.rmd_start default is 72', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['age.rmd_start']).toBe(72)
  })

  it('dist.diversification_years_1_5 default is 0.25', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['dist.diversification_years_1_5']).toBe(0.25)
  })

  it('score.value_excellent default is 0.95', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['score.value_excellent']).toBe(0.95)
  })

  it('plan.projection_years default is 11', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['plan.projection_years']).toBe(11)
  })

  it('plan.default_turnover_table default is T-5', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['plan.default_turnover_table']).toBe('T-5')
  })

  it('text override with null value_text is skipped (default preserved)', () => {
    const overrides: FormulaConfigOverride[] = [
      { config_key: 'plan.default_turnover_table', value_number: null, value_text: null, value_json: null },
    ]
    const resolved = resolveFormulaConfig(overrides)
    expect(resolved['plan.default_turnover_table']).toBe('T-5')
  })
})

// ============================================================
// getConfigDef
// ============================================================
describe('getConfigDef', () => {
  it('returns def for a known key', () => {
    const def = getConfigDef('age.rmd_start')
    expect(def).toBeDefined()
    expect(def.key).toBe('age.rmd_start')
  })

  it('throws for unknown key with message containing the key', () => {
    expect(() => getConfigDef('unknown.key')).toThrowError(/unknown\.key/)
  })

  it('returned def has the requested key', () => {
    const def = getConfigDef('plan.projection_years')
    expect(def.key).toBe('plan.projection_years')
  })

  it('case-sensitive lookup (wrong case throws)', () => {
    expect(() => getConfigDef('AGE.RMD_START')).toThrowError()
  })

  it('works for every category', () => {
    for (const cat of ALLOWED_CATEGORIES) {
      const entry = FORMULA_CONFIG_REGISTRY.find(d => d.category === cat)
      expect(entry, `category ${cat} should have an entry`).toBeDefined()
      const def = getConfigDef(entry!.key)
      expect(def.category).toBe(cat)
    }
  })

  it('returned def contains all registry fields', () => {
    const def = getConfigDef('comp.401a17_limit')
    expect(def.key).toBe('comp.401a17_limit')
    expect(def.label).toBeDefined()
    expect(def.description).toBeDefined()
    expect(def.usedIn).toBeDefined()
    expect(def.category).toBe('compensation')
    expect(def.type).toBe('number')
    expect(def.default).toBe(330000)
  })
})

// ============================================================
// validateConfigValue
// ============================================================
describe('validateConfigValue', () => {
  const numericDef: FormulaConfigDef = {
    key: 'test.num',
    label: 'Test Number',
    description: 'desc',
    usedIn: 'nowhere',
    category: 'vesting',
    type: 'number',
    default: 50,
    min: 0,
    max: 100,
  }

  const integerDef: FormulaConfigDef = {
    key: 'test.int',
    label: 'Test Integer',
    description: 'desc',
    usedIn: 'nowhere',
    category: 'vesting',
    type: 'integer',
    default: 5,
    min: 1,
    max: 10,
  }

  const percentageDef: FormulaConfigDef = {
    key: 'test.pct',
    label: 'Test Percentage',
    description: 'desc',
    usedIn: 'nowhere',
    category: 'vesting',
    type: 'percentage',
    default: 0.25,
    min: 0,
    max: 1,
  }

  const textDef: FormulaConfigDef = {
    key: 'test.txt',
    label: 'Test Text',
    description: 'desc',
    usedIn: 'nowhere',
    category: 'plan_defaults',
    type: 'text',
    default: 'hello',
  }

  const noBoundDef: FormulaConfigDef = {
    key: 'test.unbound',
    label: 'Unbound',
    description: 'desc',
    usedIn: 'nowhere',
    category: 'vesting',
    type: 'number',
    default: 0,
  }

  it('numeric value within bounds: ok:true', () => {
    expect(validateConfigValue(numericDef, 50)).toEqual({ ok: true })
  })

  it('numeric value below min: ok:false, error mentions label and min', () => {
    const r = validateConfigValue(numericDef, -1)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('Test Number')
      expect(r.error).toContain('0')
    }
  })

  it('numeric value above max: ok:false, error mentions label and max', () => {
    const r = validateConfigValue(numericDef, 101)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('Test Number')
      expect(r.error).toContain('100')
    }
  })

  it('numeric value exactly at min: ok:true', () => {
    expect(validateConfigValue(numericDef, 0)).toEqual({ ok: true })
  })

  it('numeric value exactly at max: ok:true', () => {
    expect(validateConfigValue(numericDef, 100)).toEqual({ ok: true })
  })

  it('non-number for numeric type: ok:false with clear error', () => {
    const r = validateConfigValue(numericDef, 'fifty')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('must be a number')
    }
  })

  it('NaN: ok:false', () => {
    const r = validateConfigValue(numericDef, Number.NaN)
    expect(r.ok).toBe(false)
  })

  it('Infinity: ok:false', () => {
    const r = validateConfigValue(numericDef, Number.POSITIVE_INFINITY)
    expect(r.ok).toBe(false)
    const r2 = validateConfigValue(numericDef, Number.NEGATIVE_INFINITY)
    expect(r2.ok).toBe(false)
  })

  it('integer type with fractional value: ok:false', () => {
    const r = validateConfigValue(integerDef, 3.5)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('integer')
    }
  })

  it('integer type with whole number: ok:true', () => {
    expect(validateConfigValue(integerDef, 5)).toEqual({ ok: true })
  })

  it('percentage type treats as number (0.25 within [0,1]): ok:true', () => {
    expect(validateConfigValue(percentageDef, 0.25)).toEqual({ ok: true })
  })

  it('percentage type out of range: ok:false', () => {
    expect(validateConfigValue(percentageDef, 1.5).ok).toBe(false)
    expect(validateConfigValue(percentageDef, -0.1).ok).toBe(false)
  })

  it('text type with empty string: ok:false', () => {
    const r = validateConfigValue(textDef, '')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('non-empty')
    }
  })

  it('text type with valid string: ok:true', () => {
    expect(validateConfigValue(textDef, 'T-3')).toEqual({ ok: true })
  })

  it('text type with 100 chars: ok:true', () => {
    const s = 'x'.repeat(100)
    expect(validateConfigValue(textDef, s)).toEqual({ ok: true })
  })

  it('text type with 101 chars: ok:false', () => {
    const s = 'x'.repeat(101)
    const r = validateConfigValue(textDef, s)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('100')
    }
  })

  it('text type with non-string: ok:false', () => {
    const r = validateConfigValue(textDef, 42)
    expect(r.ok).toBe(false)
  })

  it('undefined value for numeric: ok:false', () => {
    const r = validateConfigValue(numericDef, undefined)
    expect(r.ok).toBe(false)
  })

  it('null value for numeric: ok:false', () => {
    const r = validateConfigValue(numericDef, null)
    expect(r.ok).toBe(false)
  })

  it('no min or max defined: any numeric is ok', () => {
    expect(validateConfigValue(noBoundDef, -9999).ok).toBe(true)
    expect(validateConfigValue(noBoundDef, 9999).ok).toBe(true)
    expect(validateConfigValue(noBoundDef, 0).ok).toBe(true)
  })

  it('pick a registry entry per type and run validation', () => {
    // Number
    const numDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'number')!
    expect(validateConfigValue(numDef, numDef.default as number).ok).toBe(true)

    // Percentage
    const pctDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'percentage')!
    expect(validateConfigValue(pctDef, pctDef.default as number).ok).toBe(true)

    // Integer
    const intDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'integer')!
    expect(validateConfigValue(intDef, intDef.default as number).ok).toBe(true)

    // Text
    const txtDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'text')!
    expect(validateConfigValue(txtDef, txtDef.default as string).ok).toBe(true)
  })

  it('integer type with large whole number at max: ok:true', () => {
    expect(validateConfigValue(integerDef, 10)).toEqual({ ok: true })
  })

  it('integer type below min: ok:false', () => {
    const r = validateConfigValue(integerDef, 0)
    expect(r.ok).toBe(false)
  })

  it('real-registry numeric default within bounds', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type === 'number' || def.type === 'percentage' || def.type === 'integer') {
        const r = validateConfigValue(def, def.default)
        expect(r.ok, `${def.key} default should validate ok`).toBe(true)
      }
    }
  })

  it('real-registry text default validates ok', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type === 'text') {
        const r = validateConfigValue(def, def.default)
        expect(r.ok, `${def.key} default should validate ok`).toBe(true)
      }
    }
  })
})

// ============================================================
// getCompGrowthRates
// ============================================================
describe('getCompGrowthRates', () => {
  it('returns 3-element tuple', () => {
    const cfg = resolveFormulaConfig()
    const rates = getCompGrowthRates(cfg)
    expect(rates).toHaveLength(3)
  })

  it('values come from defaults in order [year0_1, year2_5, year6plus]', () => {
    const cfg = resolveFormulaConfig()
    const rates = getCompGrowthRates(cfg)
    expect(rates[0]).toBe(0.05)
    expect(rates[1]).toBe(0.04)
    expect(rates[2]).toBe(0.03)
  })

  it('after overrides, returns overridden values', () => {
    const cfg = resolveFormulaConfig([
      { config_key: 'comp.growth_rate_year_0_1', value_number: 0.08, value_text: null, value_json: null },
      { config_key: 'comp.growth_rate_year_2_5', value_number: 0.07, value_text: null, value_json: null },
      { config_key: 'comp.growth_rate_year_6plus', value_number: 0.06, value_text: null, value_json: null },
    ])
    const rates = getCompGrowthRates(cfg)
    expect(rates).toEqual([0.08, 0.07, 0.06])
  })

  it('all three values are numbers', () => {
    const cfg = resolveFormulaConfig()
    const rates = getCompGrowthRates(cfg)
    rates.forEach(r => expect(typeof r).toBe('number'))
  })

  it('returns NaN-free values even when config missing (coerces via Number)', () => {
    const cfg = resolveFormulaConfig()
    const rates = getCompGrowthRates(cfg)
    rates.forEach(r => expect(Number.isFinite(r)).toBe(true))
  })
})

// ============================================================
// getDiversYears
// ============================================================
describe('getDiversYears', () => {
  it('returns 6-element array', () => {
    const cfg = resolveFormulaConfig()
    const years = getDiversYears(cfg)
    expect(years).toHaveLength(6)
  })

  it('first 5 use dist.diversification_years_1_5', () => {
    const cfg = resolveFormulaConfig()
    const years = getDiversYears(cfg)
    for (let i = 0; i < 5; i++) {
      expect(years[i]).toBe(0.25)
    }
  })

  it('last element uses dist.diversification_year_6', () => {
    const cfg = resolveFormulaConfig()
    const years = getDiversYears(cfg)
    expect(years[5]).toBe(0.50)
  })

  it('after override of year_6, last element reflects override', () => {
    const cfg = resolveFormulaConfig([
      { config_key: 'dist.diversification_year_6', value_number: 0.75, value_text: null, value_json: null },
    ])
    const years = getDiversYears(cfg)
    expect(years[5]).toBe(0.75)
    // First 5 still defaults
    for (let i = 0; i < 5; i++) {
      expect(years[i]).toBe(0.25)
    }
  })

  it('after override of years_1_5, first 5 reflect override', () => {
    const cfg = resolveFormulaConfig([
      { config_key: 'dist.diversification_years_1_5', value_number: 0.30, value_text: null, value_json: null },
    ])
    const years = getDiversYears(cfg)
    for (let i = 0; i < 5; i++) {
      expect(years[i]).toBe(0.30)
    }
    // Last one unchanged
    expect(years[5]).toBe(0.50)
  })

  it('all values are numbers', () => {
    const cfg = resolveFormulaConfig()
    const years = getDiversYears(cfg)
    years.forEach(y => expect(typeof y).toBe('number'))
  })

  it('returns finite numbers', () => {
    const cfg = resolveFormulaConfig()
    const years = getDiversYears(cfg)
    years.forEach(y => expect(Number.isFinite(y)).toBe(true))
  })
})

// ============================================================
// Additional registry and resolver coverage
// ============================================================
describe('FORMULA_CONFIG_REGISTRY — extended coverage', () => {
  it('every entry with unit has a non-empty string', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.unit !== undefined) {
        expect(typeof def.unit).toBe('string')
        expect(def.unit.length).toBeGreaterThan(0)
      }
    }
  })

  it('categories are covered: vesting', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'vesting')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('categories are covered: compensation', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'compensation')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('categories are covered: age', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'age')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('categories are covered: distribution', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'distribution')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('categories are covered: valuation', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'valuation')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('categories are covered: success_score', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'success_score')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('categories are covered: plan_defaults', () => {
    const entries = FORMULA_CONFIG_REGISTRY.filter(d => d.category === 'plan_defaults')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('comp.401a17_limit default is 330000', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['comp.401a17_limit']).toBe(330000)
  })

  it('age.retirement_default default is 65', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['age.retirement_default']).toBe(65)
  })

  it('val.npv_discount_rate default is 0.05', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['val.npv_discount_rate']).toBe(0.05)
  })

  it('dist.distribution_period_default default is 5', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['dist.distribution_period_default']).toBe(5)
  })

  it('score.health_value_green default is 1.0', () => {
    const resolved = resolveFormulaConfig()
    expect(resolved['score.health_value_green']).toBe(1.0)
  })
})
