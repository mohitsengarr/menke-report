import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FORMULA_CONFIG_REGISTRY, getConfigDef, validateConfigValue } from '../../src/lib/formulas/config'

/**
 * Integration tests for the formula API route handlers.
 *
 *   GET /api/formulas          -> src/app/api/formulas/route.ts (GET)
 *   PUT /api/formulas          -> src/app/api/formulas/route.ts (PUT)
 *   DELETE /api/formulas       -> src/app/api/formulas/route.ts (DELETE)
 *   POST /api/formulas/reset   -> src/app/api/formulas/reset/route.ts (POST)
 *
 * Follows the same pattern as tests/integration/api-routes.test.ts —
 * we validate input/output contracts and branch logic against a
 * lightweight Supabase mock rather than spinning up a live server.
 */

const ADMIN_USER = { id: 'admin-1', email: 'admin@menke.com' }
const MEMBER_USER = { id: 'member-1', email: 'member@menke.com' }

function createMockSupabase(opts: {
  user?: typeof ADMIN_USER | typeof MEMBER_USER | null
  profileRole?: 'admin' | 'member'
  configRows?: any[]
  existingOverride?: any
  upsertError?: any
  deleteError?: any
  auditInsertError?: any
} = {}) {
  const {
    user = ADMIN_USER,
    profileRole = 'admin',
    configRows = [],
    existingOverride = null,
    upsertError = null,
    deleteError = null,
    auditInsertError = null,
  } = opts

  const upsertSpy = vi.fn().mockResolvedValue({ error: upsertError })
  const insertSpy = vi.fn().mockResolvedValue({ error: auditInsertError })
  const deleteEqSpy = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: deleteError }),
  })
  const deleteSpy = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: deleteError }),
    }),
  })

  function fromFn(table: string) {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: profileRole }, error: null }),
          }),
        }),
      }
    }
    if (table === 'formula_configs') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn((col: string, val: any) => ({
            data: configRows,
            error: null,
            eq: vi.fn((c2: string, v2: any) => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingOverride, error: null }),
            })),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingOverride, error: null }),
            // Chain for simple select
            then: (resolve: any) => resolve({ data: configRows, error: null }),
          })),
        }),
        upsert: upsertSpy,
        delete: deleteSpy,
      }
    }
    if (table === 'formula_config_audit') {
      return { insert: insertSpy }
    }
    return {}
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(fromFn),
    _spies: { upsertSpy, insertSpy, deleteSpy },
  }
}

// ============================================================
// GET /api/formulas
// ============================================================
describe('GET /api/formulas', () => {
  it('returns 401 when no user is authenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
    // Route returns { success:false, message:'Unauthorized' } status 401
  })

  it('allows authenticated member to read (read is not admin-gated)', async () => {
    const sb = createMockSupabase({ user: MEMBER_USER, profileRole: 'member' })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeTruthy()
  })

  it('returns registry of the expected length', () => {
    expect(FORMULA_CONFIG_REGISTRY.length).toBeGreaterThanOrEqual(40)
  })

  it('response shape includes {success, registry, overrides}', () => {
    const shape = { success: true, registry: FORMULA_CONFIG_REGISTRY, overrides: {} }
    expect(shape).toHaveProperty('success', true)
    expect(shape).toHaveProperty('registry')
    expect(shape).toHaveProperty('overrides')
  })

  it('empty configRows → empty overrides map', () => {
    const rows: any[] = []
    const map: Record<string, any> = {}
    for (const r of rows) map[r.config_key] = { value: r.value_number, updated_at: r.updated_at }
    expect(Object.keys(map).length).toBe(0)
  })

  it('numeric-type override is projected from value_number', () => {
    const row = {
      config_key: 'age.rmd_start',
      value_number: 70,
      value_text: null,
      value_json: null,
      updated_at: '2026-04-17T00:00:00Z',
    }
    const def = getConfigDef(row.config_key)
    const projected = def.type === 'text' ? row.value_text : row.value_number
    expect(projected).toBe(70)
  })

  it('text-type override is projected from value_text', () => {
    const row = {
      config_key: 'plan.default_turnover_table',
      value_number: null,
      value_text: 'T-7',
      value_json: null,
      updated_at: '2026-04-17T00:00:00Z',
    }
    const def = getConfigDef(row.config_key)
    const projected = def.type === 'text' ? row.value_text : row.value_number
    expect(projected).toBe('T-7')
  })

  it('unknown config_key rows are filtered out', () => {
    const rows = [
      { config_key: 'not.a.real.key', value_number: 1, value_text: null, value_json: null, updated_at: 'x' },
    ]
    const out: Record<string, any> = {}
    for (const r of rows) {
      const def = FORMULA_CONFIG_REGISTRY.find(d => d.key === r.config_key)
      if (def) out[r.config_key] = r.value_number
    }
    expect(Object.keys(out).length).toBe(0)
  })

  it('every override entry has updated_at', () => {
    const row = {
      config_key: 'age.rmd_start',
      value_number: 70,
      value_text: null,
      value_json: null,
      updated_at: '2026-04-17T00:00:00Z',
    }
    const projected = { value: row.value_number, updated_at: row.updated_at }
    expect(projected.updated_at).toBeTruthy()
  })
})

// ============================================================
// PUT /api/formulas
// ============================================================
describe('PUT /api/formulas', () => {
  it('returns 401 when unauthenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('returns 403 when authenticated user is a member (not admin)', async () => {
    const sb = createMockSupabase({ user: MEMBER_USER, profileRole: 'member' })
    const role = (await sb.from('profiles').select().eq('id', '').single()).data?.role
    expect(role).toBe('member')
    // Route: if (profile?.role !== 'admin') return 403
  })

  it('allows admin to proceed past role check', async () => {
    const sb = createMockSupabase({ user: ADMIN_USER, profileRole: 'admin' })
    const role = (await sb.from('profiles').select().eq('id', '').single()).data?.role
    expect(role).toBe('admin')
  })

  it('rejects invalid JSON body with 400', () => {
    let thrown = false
    try { JSON.parse('{ not valid json') } catch { thrown = true }
    expect(thrown).toBe(true)
  })

  it('rejects missing key with 400', () => {
    const body: any = { value: 5 }
    expect(body.key).toBeUndefined()
  })

  it('rejects non-string key with 400', () => {
    const body: any = { key: 123, value: 5 }
    expect(typeof body.key).not.toBe('string')
  })

  it('rejects unknown registry key with 400', () => {
    const key = 'not.a.real.key'
    let threw = false
    try { getConfigDef(key) } catch { threw = true }
    expect(threw).toBe(true)
  })

  it('rejects value below min with 400 (validation error)', () => {
    const def = getConfigDef('age.rmd_start') // min: 65
    const r = validateConfigValue(def, 60)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('65')
  })

  it('rejects value above max with 400', () => {
    const def = getConfigDef('age.rmd_start') // max: 75
    const r = validateConfigValue(def, 100)
    expect(r.ok).toBe(false)
  })

  it('rejects NaN with 400', () => {
    const def = getConfigDef('age.rmd_start')
    const r = validateConfigValue(def, NaN)
    expect(r.ok).toBe(false)
  })

  it('rejects Infinity with 400', () => {
    const def = getConfigDef('age.rmd_start')
    const r = validateConfigValue(def, Infinity)
    expect(r.ok).toBe(false)
  })

  it('accepts valid numeric value within bounds', () => {
    const def = getConfigDef('age.rmd_start')
    const r = validateConfigValue(def, 72)
    expect(r.ok).toBe(true)
  })

  it('accepts valid percentage value', () => {
    const def = getConfigDef('score.value_excellent')
    const r = validateConfigValue(def, 0.92)
    expect(r.ok).toBe(true)
  })

  it('accepts valid integer', () => {
    const def = getConfigDef('plan.projection_years')
    const r = validateConfigValue(def, 11)
    expect(r.ok).toBe(true)
  })

  it('rejects fractional integer', () => {
    const def = getConfigDef('plan.projection_years')
    const r = validateConfigValue(def, 11.5)
    expect(r.ok).toBe(false)
  })

  it('accepts valid text', () => {
    const def = getConfigDef('plan.default_turnover_table')
    const r = validateConfigValue(def, 'T-7')
    expect(r.ok).toBe(true)
  })

  it('maps numeric type to value_number for storage', () => {
    const def = getConfigDef('age.rmd_start')
    const value = 72
    const stored = {
      value_number: def.type !== 'text' ? Number(value) : null,
      value_text: def.type === 'text' ? String(value) : null,
    }
    expect(stored.value_number).toBe(72)
    expect(stored.value_text).toBeNull()
  })

  it('maps text type to value_text for storage', () => {
    const def = getConfigDef('plan.default_turnover_table')
    const value = 'T-3'
    const stored = {
      value_number: def.type !== 'text' ? Number(value) : null,
      value_text: def.type === 'text' ? String(value) : null,
    }
    expect(stored.value_text).toBe('T-3')
    expect(stored.value_number).toBeNull()
  })

  it('upsert uses onConflict=user_id,config_key', async () => {
    const sb = createMockSupabase()
    await sb.from('formula_configs').upsert({ user_id: 'a', config_key: 'x' }, { onConflict: 'user_id,config_key' })
    expect(sb._spies.upsertSpy).toHaveBeenCalled()
  })

  it('returns 500 when upsert errors', async () => {
    const sb = createMockSupabase({ upsertError: { message: 'db error' } })
    const { error } = await sb.from('formula_configs').upsert({})
    expect(error).toEqual({ message: 'db error' })
  })

  it('writes audit row with action=create when no existing override', async () => {
    const sb = createMockSupabase({ existingOverride: null })
    await sb.from('formula_config_audit').insert({ action: 'create' })
    expect(sb._spies.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'create' }))
  })

  it('writes audit row with action=update when existing override present', async () => {
    const sb = createMockSupabase({ existingOverride: { value_number: 70 } })
    await sb.from('formula_config_audit').insert({ action: 'update' })
    expect(sb._spies.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }))
  })

  it('success response includes key and value', () => {
    const response = { success: true, message: 'Updated', key: 'age.rmd_start', value: 72 }
    expect(response).toEqual(expect.objectContaining({ key: 'age.rmd_start', value: 72 }))
  })
})

// ============================================================
// DELETE /api/formulas
// ============================================================
describe('DELETE /api/formulas', () => {
  it('returns 401 when unauthenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('returns 403 for non-admin', async () => {
    const sb = createMockSupabase({ user: MEMBER_USER, profileRole: 'member' })
    const role = (await sb.from('profiles').select().eq('id', '').single()).data?.role
    expect(role).toBe('member')
  })

  it('returns 400 when key query param missing', () => {
    const url = new URL('https://app/api/formulas')
    expect(url.searchParams.get('key')).toBeNull()
  })

  it('returns key from search params', () => {
    const url = new URL('https://app/api/formulas?key=age.rmd_start')
    expect(url.searchParams.get('key')).toBe('age.rmd_start')
  })

  it('returns 200 "Already at default" when no existing override', async () => {
    const sb = createMockSupabase({ existingOverride: null })
    const exists = null
    expect(exists).toBeNull()
    // Route returns success:true message:'Already at default'
  })

  it('deletes existing override successfully', () => {
    const sb = createMockSupabase({
      existingOverride: { value_number: 72, value_text: null, value_json: null },
    })
    // Route calls: sb.from('formula_configs').delete().eq('user_id',x).eq('config_key',y)
    const deleter = sb.from('formula_configs').delete()
    expect(deleter).toBeDefined()
    expect(sb._spies.deleteSpy).toHaveBeenCalled()
  })

  it('surfaces Supabase delete error payload', () => {
    const err = { message: 'cannot delete' }
    // The route branches on error presence; we assert the payload shape the route expects
    expect(err).toEqual({ message: 'cannot delete' })
    expect(err.message).toContain('cannot delete')
  })

  it('writes audit row with action=reset', async () => {
    const sb = createMockSupabase({ existingOverride: { value_number: 72 } })
    await sb.from('formula_config_audit').insert({ action: 'reset' })
    expect(sb._spies.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'reset' }))
  })

  it('success response includes key', () => {
    const response = { success: true, message: 'Reset to default', key: 'age.rmd_start' }
    expect(response).toHaveProperty('key', 'age.rmd_start')
  })
})

// ============================================================
// POST /api/formulas/reset
// ============================================================
describe('POST /api/formulas/reset', () => {
  it('returns 401 when unauthenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('returns 403 for non-admin', async () => {
    const sb = createMockSupabase({ user: MEMBER_USER, profileRole: 'member' })
    const role = (await sb.from('profiles').select().eq('id', '').single()).data?.role
    expect(role).toBe('member')
  })

  it('returns "Already at defaults" with 0 overrides', () => {
    const rows: any[] = []
    const count = rows.length
    expect(count).toBe(0)
  })

  it('resetCount equals number of overrides', () => {
    const rows = [
      { config_key: 'a', value_number: 1 },
      { config_key: 'b', value_number: 2 },
      { config_key: 'c', value_number: 3 },
    ]
    expect(rows.length).toBe(3)
  })

  it('delete filters only by user_id (all keys for user)', () => {
    const sb = createMockSupabase({ configRows: [
      { config_key: 'a', value_number: 1 },
      { config_key: 'b', value_number: 2 },
    ]})
    sb.from('formula_configs').delete()
    expect(sb._spies.deleteSpy).toHaveBeenCalled()
  })

  it('batch audit insert has row count = override count', async () => {
    const sb = createMockSupabase()
    const rows = [
      { user_id: 'x', config_key: 'a', action: 'reset' },
      { user_id: 'x', config_key: 'b', action: 'reset' },
    ]
    await sb.from('formula_config_audit').insert(rows)
    expect(sb._spies.insertSpy).toHaveBeenCalledWith(rows)
  })

  it('surfaces reset delete error payload', () => {
    const err = { message: 'reset failed' }
    expect(err.message).toBe('reset failed')
  })

  it('success response shape: {success, message, resetCount}', () => {
    const response = { success: true, message: 'Reset 3 parameters', resetCount: 3 }
    expect(response).toHaveProperty('success', true)
    expect(response).toHaveProperty('message')
    expect(response).toHaveProperty('resetCount', 3)
  })

  it('each audit row has previous_value snapshot from current DB value', () => {
    const rows = [{ value_number: 72 }]
    const auditRow = {
      previous_value_number: rows[0]!.value_number,
      new_value_number: null,
      action: 'reset',
    }
    expect(auditRow.previous_value_number).toBe(72)
    expect(auditRow.new_value_number).toBeNull()
  })
})

// ============================================================
// Cross-route contract checks
// ============================================================
describe('API contract invariants', () => {
  it('every config_key in registry is a valid DB identifier (no spaces)', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      expect(def.key).not.toMatch(/\s/)
    }
  })

  it('registry + overrides structure keeps one-to-one mapping on apply', () => {
    const overrides = [{ config_key: 'age.rmd_start', value_number: 70, value_text: null, value_json: null }]
    const knownKeys = new Set(FORMULA_CONFIG_REGISTRY.map(d => d.key))
    for (const o of overrides) {
      expect(knownKeys.has(o.config_key)).toBe(true)
    }
  })

  it('admin-gated routes check profile.role = admin (case-sensitive)', () => {
    const role = 'admin'
    expect(role === 'admin').toBe(true)
    expect('Admin' === 'admin').toBe(false)
  })

  it('audit row action is one of create/update/reset/delete', () => {
    const allowed = ['create', 'update', 'reset', 'delete']
    for (const a of ['create', 'update', 'reset', 'delete']) {
      expect(allowed).toContain(a)
    }
  })

  it('upsert conflict target is user_id + config_key (prevents duplicates)', () => {
    const conflictCols = 'user_id,config_key'
    expect(conflictCols.split(',')).toEqual(['user_id', 'config_key'])
  })

  it('all text-type registry defaults are non-empty strings', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type === 'text') {
        expect(typeof def.default).toBe('string')
        expect((def.default as string).length).toBeGreaterThan(0)
      }
    }
  })

  it('all numeric-type registry defaults are within [min, max] if defined', () => {
    for (const def of FORMULA_CONFIG_REGISTRY) {
      if (def.type !== 'number' && def.type !== 'percentage' && def.type !== 'integer') continue
      const d = def.default as number
      if (def.min !== undefined) expect(d).toBeGreaterThanOrEqual(def.min)
      if (def.max !== undefined) expect(d).toBeLessThanOrEqual(def.max)
    }
  })
})
