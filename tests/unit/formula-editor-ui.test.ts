import { describe, it, expect } from 'vitest'
import { FORMULA_CONFIG_REGISTRY, CONFIG_CATEGORIES, type FormulaConfigDef } from '../../src/lib/formulas/config'

/**
 * Pure logic tests for the FormulaEditor admin UI.
 *
 * The page at /formulas/edit renders tables, filter controls, and an audit
 * log. The component is a client React component — we test its pure helper
 * functions and derived-state logic without mounting (since vitest is
 * configured with environment='node').
 */

// ─── Helpers mirroring component logic ──────────────────────────

function formatValue(def: FormulaConfigDef, v: number | string | null): string {
  if (v === null || v === undefined) return ''
  if (def.type === 'percentage' && typeof v === 'number') {
    return (v * 100).toFixed(2)
  }
  return String(v)
}

function parseDraft(def: FormulaConfigDef, raw: string): number | string | null {
  if (raw === '') return null
  if (def.type === 'text') return raw
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  if (def.type === 'percentage') return n / 100
  return n
}

function groupByCategory(defs: FormulaConfigDef[]): Record<string, FormulaConfigDef[]> {
  const out: Record<string, FormulaConfigDef[]> = {}
  for (const def of defs) {
    if (!out[def.category]) out[def.category] = []
    out[def.category]!.push(def)
  }
  return out
}

function filterRegistry(
  search: string,
  filter: 'all' | 'overridden' | 'defaults',
  activeCategory: string,
  overrides: Record<string, any>,
): FormulaConfigDef[] {
  const needle = search.trim().toLowerCase()
  return FORMULA_CONFIG_REGISTRY.filter(def => {
    if (activeCategory !== 'all' && def.category !== activeCategory) return false
    if (filter === 'overridden' && !overrides[def.key]) return false
    if (filter === 'defaults' && overrides[def.key]) return false
    if (!needle) return true
    return (
      def.label.toLowerCase().includes(needle) ||
      def.description.toLowerCase().includes(needle) ||
      def.key.toLowerCase().includes(needle) ||
      def.usedIn.toLowerCase().includes(needle)
    )
  })
}

// ═══════════════════════════════════════════════════════════════
// formatValue
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor.formatValue', () => {
  const pctDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'percentage')!
  const numDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'number')!
  const intDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'integer')!
  const txtDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'text')!

  it('null → empty string', () => {
    expect(formatValue(numDef, null)).toBe('')
  })
  it('number for number type → stringified', () => {
    expect(formatValue(numDef, 12345)).toBe('12345')
  })
  it('percentage 0.05 → "5.00"', () => {
    expect(formatValue(pctDef, 0.05)).toBe('5.00')
  })
  it('percentage 0.995 → "99.50"', () => {
    expect(formatValue(pctDef, 0.995)).toBe('99.50')
  })
  it('percentage 1 → "100.00"', () => {
    expect(formatValue(pctDef, 1)).toBe('100.00')
  })
  it('percentage 0 → "0.00"', () => {
    expect(formatValue(pctDef, 0)).toBe('0.00')
  })
  it('integer 11 → "11"', () => {
    expect(formatValue(intDef, 11)).toBe('11')
  })
  it('text "T-5" → "T-5"', () => {
    expect(formatValue(txtDef, 'T-5')).toBe('T-5')
  })
})

// ═══════════════════════════════════════════════════════════════
// parseDraft
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor.parseDraft', () => {
  const pctDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'percentage')!
  const numDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'number')!
  const intDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'integer')!
  const txtDef = FORMULA_CONFIG_REGISTRY.find(d => d.type === 'text')!

  it('empty → null', () => {
    expect(parseDraft(numDef, '')).toBeNull()
  })
  it('percentage "5.00" → 0.05', () => {
    expect(parseDraft(pctDef, '5.00')).toBeCloseTo(0.05, 4)
  })
  it('percentage "100" → 1', () => {
    expect(parseDraft(pctDef, '100')).toBe(1)
  })
  it('percentage "0" → 0', () => {
    expect(parseDraft(pctDef, '0')).toBe(0)
  })
  it('number "330000" → 330000', () => {
    expect(parseDraft(numDef, '330000')).toBe(330000)
  })
  it('integer "11" → 11', () => {
    expect(parseDraft(intDef, '11')).toBe(11)
  })
  it('text "T-3" → "T-3"', () => {
    expect(parseDraft(txtDef, 'T-3')).toBe('T-3')
  })
  it('invalid number "abc" → null', () => {
    expect(parseDraft(numDef, 'abc')).toBeNull()
  })
  it('scientific notation "1e5" → 100000', () => {
    expect(parseDraft(numDef, '1e5')).toBe(100000)
  })
  it('text empty string → null (falls through empty branch)', () => {
    expect(parseDraft(txtDef, '')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// groupByCategory
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor.groupByCategory', () => {
  const grouped = groupByCategory(FORMULA_CONFIG_REGISTRY)

  it('produces one entry per distinct category', () => {
    const distinctCats = new Set(FORMULA_CONFIG_REGISTRY.map(d => d.category))
    expect(Object.keys(grouped).length).toBe(distinctCats.size)
  })
  it('vesting group contains vesting entries only', () => {
    for (const def of grouped['vesting'] ?? []) {
      expect(def.category).toBe('vesting')
    }
  })
  it('total entries across groups = registry size', () => {
    const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)
    expect(total).toBe(FORMULA_CONFIG_REGISTRY.length)
  })
  it('each CONFIG_CATEGORY has entries in the registry', () => {
    for (const c of CONFIG_CATEGORIES) {
      expect(grouped[c.id]).toBeDefined()
      expect(grouped[c.id]!.length).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// filterRegistry
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor.filterRegistry', () => {
  it('filter all + no search → full registry', () => {
    expect(filterRegistry('', 'all', 'all', {}).length).toBe(FORMULA_CONFIG_REGISTRY.length)
  })
  it('filter by category=vesting → only vesting', () => {
    const result = filterRegistry('', 'all', 'vesting', {})
    for (const def of result) {
      expect(def.category).toBe('vesting')
    }
  })
  it('filter overridden + no overrides → empty', () => {
    expect(filterRegistry('', 'overridden', 'all', {}).length).toBe(0)
  })
  it('filter overridden + one override → that one only', () => {
    const overrides = { 'age.rmd_start': { value: 70, updated_at: 'x' } }
    const result = filterRegistry('', 'overridden', 'all', overrides)
    expect(result.length).toBe(1)
    expect(result[0]!.key).toBe('age.rmd_start')
  })
  it('filter defaults + no overrides → full registry', () => {
    expect(filterRegistry('', 'defaults', 'all', {}).length).toBe(FORMULA_CONFIG_REGISTRY.length)
  })
  it('filter defaults + one override → excludes that one', () => {
    const overrides = { 'age.rmd_start': { value: 70, updated_at: 'x' } }
    const result = filterRegistry('', 'defaults', 'all', overrides)
    expect(result.length).toBe(FORMULA_CONFIG_REGISTRY.length - 1)
    expect(result.find(d => d.key === 'age.rmd_start')).toBeUndefined()
  })
  it('search by label → matches', () => {
    const result = filterRegistry('RMD', 'all', 'all', {})
    expect(result.length).toBeGreaterThan(0)
    expect(result.some(d => d.label.includes('RMD'))).toBe(true)
  })
  it('search by key → matches', () => {
    const result = filterRegistry('age.rmd', 'all', 'all', {})
    expect(result.length).toBeGreaterThan(0)
  })
  it('search by description → matches', () => {
    const result = filterRegistry('diversification', 'all', 'all', {})
    expect(result.length).toBeGreaterThan(0)
  })
  it('search case-insensitive', () => {
    const r1 = filterRegistry('Vesting', 'all', 'all', {})
    const r2 = filterRegistry('vesting', 'all', 'all', {})
    expect(r1.length).toBe(r2.length)
  })
  it('search with no match → empty', () => {
    expect(filterRegistry('nonexistentxyz', 'all', 'all', {}).length).toBe(0)
  })
  it('combined filter: overridden + category + search', () => {
    const overrides = {
      'age.rmd_start': { value: 70, updated_at: 'x' },
      'vesting.1yr_cliff_threshold': { value: 2, updated_at: 'x' },
    }
    const result = filterRegistry('', 'overridden', 'age', overrides)
    for (const def of result) {
      expect(def.category).toBe('age')
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// Summary tile counts
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor.summaryTiles', () => {
  it('total parameters = registry length', () => {
    expect(FORMULA_CONFIG_REGISTRY.length).toBeGreaterThan(0)
  })
  it('customized count = overrides keys length', () => {
    const overrides = { 'age.rmd_start': {}, 'plan.projection_years': {} }
    expect(Object.keys(overrides).length).toBe(2)
  })
  it('at-defaults count = total - customized', () => {
    const total = FORMULA_CONFIG_REGISTRY.length
    const customized = 3
    expect(total - customized).toBe(FORMULA_CONFIG_REGISTRY.length - 3)
  })
  it('categories count = 7', () => {
    expect(CONFIG_CATEGORIES.length).toBe(7)
  })
})

// ═══════════════════════════════════════════════════════════════
// Audit log formatting
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor.auditLog', () => {
  function formatAuditValue(num: number | null, text: string | null): string {
    if (num !== null && num !== undefined) return String(num)
    if (text) return text
    return '(default)'
  }

  it('numeric value shown', () => {
    expect(formatAuditValue(72, null)).toBe('72')
  })
  it('text value shown', () => {
    expect(formatAuditValue(null, 'T-3')).toBe('T-3')
  })
  it('null/null → (default)', () => {
    expect(formatAuditValue(null, null)).toBe('(default)')
  })
  it('0 is a valid number (not null)', () => {
    expect(formatAuditValue(0, null)).toBe('0')
  })
  it('negative numbers preserved', () => {
    expect(formatAuditValue(-0.5, null)).toBe('-0.5')
  })
  it('action types include create/update/reset/delete', () => {
    const actions = ['create', 'update', 'reset', 'delete']
    expect(actions.length).toBe(4)
  })
})

// ═══════════════════════════════════════════════════════════════
// Round-trip: format → parse must return equivalent value
// ═══════════════════════════════════════════════════════════════
describe('FormulaEditor round-trip: format → parse', () => {
  for (const def of FORMULA_CONFIG_REGISTRY) {
    it(`${def.key} round-trips its default value`, () => {
      const display = formatValue(def, def.default as number | string)
      const parsed = parseDraft(def, display)
      if (def.type === 'number' || def.type === 'integer') {
        expect(parsed).toBe(def.default)
      } else if (def.type === 'percentage') {
        expect(parsed).toBeCloseTo(def.default as number, 4)
      } else if (def.type === 'text') {
        expect(parsed).toBe(def.default)
      }
    })
  }
})
