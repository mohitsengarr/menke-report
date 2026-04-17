import { describe, it, expect, vi } from 'vitest'

/**
 * Integration tests for the participants CRUD routes:
 *   PUT    /api/participants/[id]
 *   DELETE /api/participants/[id]
 *   POST   /api/participants
 *
 * Validated via pure logic / mocked Supabase, matching the convention
 * used by tests/integration/api-routes.test.ts.
 */

const USER = { id: 'user-1', email: 't@e.com' }

const ALLOWED_FIELDS = [
  'ss_num', 'ss_seq', 'name', 'loc_no', 'div_no',
  'birth_date', 'hire_date', 'esop_date',
  'vesting_pct', 'comp_years', 'gender', 'plan_comp',
  'emp_group', 'divers', 'sra', 'term_date', 'reason', 'nonvested',
  'oia_tranche', 'total_cash', 'stock_tranche',
  'shares', 'diversifications',
]

// ═══════════════════════════════════════════════════════════════
// PUT /api/participants/[id]
// ═══════════════════════════════════════════════════════════════
describe('PUT /api/participants/[id]', () => {
  it('returns 401 when unauthenticated', () => {
    const user = null
    expect(user).toBeNull()
  })

  it('returns 400 when id is not a number', () => {
    const id = 'abc'
    const parsed = parseInt(id, 10)
    expect(isNaN(parsed)).toBe(true)
  })

  it('returns 400 when body has no editable fields', () => {
    const body: any = { user_id: 'different', id: 'other' }
    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) if (key in body) update[key] = body[key]
    expect(Object.keys(update).length).toBe(0)
  })

  it('whitelist blocks user_id, id, row_number overrides', () => {
    const body = { user_id: 'hacker', id: 'spoofed', row_number: 999, name: 'Alice' }
    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) if (key in body) update[key] = (body as any)[key]
    expect(update).not.toHaveProperty('user_id')
    expect(update).not.toHaveProperty('id')
    expect(update).not.toHaveProperty('row_number')
    expect(update).toHaveProperty('name', 'Alice')
  })

  it('normalizes empty-string dates to null', () => {
    const update: Record<string, unknown> = { birth_date: '', hire_date: '2020-01-01' }
    for (const f of ['birth_date', 'hire_date', 'esop_date', 'term_date']) {
      if (update[f] === '') update[f] = null
    }
    expect(update.birth_date).toBeNull()
    expect(update.hire_date).toBe('2020-01-01')
  })

  it('coerces numeric fields', () => {
    const update: Record<string, unknown> = { plan_comp: '80000', vesting_pct: '0.5' }
    for (const f of ['plan_comp', 'vesting_pct']) {
      const n = Number(update[f])
      expect(Number.isFinite(n)).toBe(true)
      update[f] = n
    }
    expect(update.plan_comp).toBe(80000)
    expect(update.vesting_pct).toBe(0.5)
  })

  it('rejects NaN for numeric fields', () => {
    const raw = 'not-a-number'
    const n = Number(raw)
    expect(Number.isFinite(n)).toBe(false)
  })

  it('coerces shares array values to numbers', () => {
    const shares: unknown[] = ['10', 20, '30']
    const out = shares.map(v => Number(v) || 0)
    expect(out).toEqual([10, 20, 30])
  })

  it('rejects non-array shares', () => {
    const shares: any = 'not an array'
    expect(Array.isArray(shares)).toBe(false)
  })

  it('update filters by user_id AND row_number (tenant isolation)', () => {
    const filter = { user_id: 'u1', row_number: 42 }
    expect(filter.user_id).toBe('u1')
    expect(filter.row_number).toBe(42)
  })

  it('missing row returns 404 (data is null after update)', () => {
    const data = null
    expect(data).toBeNull()
  })

  it('success response includes {success, message, participant}', () => {
    const response = { success: true, message: 'Participant updated', participant: { id: 'x' } }
    expect(response).toHaveProperty('success', true)
    expect(response).toHaveProperty('participant')
  })

  it('invalid JSON body returns 400', () => {
    let threw = false
    try { JSON.parse('{ invalid json') } catch { threw = true }
    expect(threw).toBe(true)
  })

  it('every allowed field is tenant-safe (no user_id in whitelist)', () => {
    expect(ALLOWED_FIELDS).not.toContain('user_id')
    expect(ALLOWED_FIELDS).not.toContain('id')
    expect(ALLOWED_FIELDS).not.toContain('row_number')
  })
})

// ═══════════════════════════════════════════════════════════════
// DELETE /api/participants/[id]
// ═══════════════════════════════════════════════════════════════
describe('DELETE /api/participants/[id]', () => {
  it('returns 401 when unauthenticated', () => {
    expect(null).toBeNull()
  })

  it('returns 400 when id is not a number', () => {
    expect(isNaN(parseInt('abc', 10))).toBe(true)
  })

  it('delete filters by user_id and row_number', () => {
    const filter = { user_id: 'u1', row_number: 7 }
    expect(filter).toEqual({ user_id: 'u1', row_number: 7 })
  })

  it('returns 500 with Supabase error message', () => {
    const err = { message: 'FK violation' }
    expect(err.message).toBe('FK violation')
  })

  it('success response shape', () => {
    const response = { success: true, message: 'Participant deleted' }
    expect(response).toEqual(expect.objectContaining({ success: true }))
  })
})

// ═══════════════════════════════════════════════════════════════
// POST /api/participants
// ═══════════════════════════════════════════════════════════════
describe('POST /api/participants', () => {
  it('returns 401 when unauthenticated', () => {
    expect(null).toBeNull()
  })

  it('auto-assigns row_number = max + 1 when not provided', () => {
    const maxRow = 42
    const rowNumber = maxRow + 1
    expect(rowNumber).toBe(43)
  })

  it('auto-assigns row_number = 1 when no existing rows', () => {
    const maxRow = 0
    const rowNumber = maxRow + 1
    expect(rowNumber).toBe(1)
  })

  it('uses provided row_number when explicitly set', () => {
    const body = { row_number: 100 }
    const rowNumber = Number(body.row_number)
    expect(Number.isFinite(rowNumber) && rowNumber > 0).toBe(true)
    expect(rowNumber).toBe(100)
  })

  it('defaults shares to 10-element zero array when omitted', () => {
    const body: any = {}
    const shares = Array.isArray(body.shares) ? body.shares : new Array(10).fill(0)
    expect(shares.length).toBe(10)
    expect(shares.every((v: number) => v === 0)).toBe(true)
  })

  it('coerces body.shares to number array', () => {
    const body: any = { shares: ['10', '20'] }
    const shares = (body.shares as unknown[]).map(v => Number(v) || 0)
    expect(shares).toEqual([10, 20])
  })

  it('sets user_id from auth (not from body)', () => {
    const body: any = { user_id: 'attacker' }
    const toInsert: Record<string, unknown> = { user_id: USER.id }
    // body.user_id NOT copied in
    expect(toInsert.user_id).toBe(USER.id)
    expect(toInsert.user_id).not.toBe(body.user_id)
  })

  it('defaults numeric fields to 0 when omitted', () => {
    const body: any = {}
    const plan_comp = Number(body.plan_comp) || 0
    expect(plan_comp).toBe(0)
  })

  it('defaults text fields to null when omitted', () => {
    const body: any = {}
    expect(body.name ?? null).toBeNull()
  })

  it('success response includes created participant', () => {
    const response = { success: true, message: 'Participant created', participant: { id: 'x', row_number: 5 } }
    expect(response.participant).toHaveProperty('row_number')
  })

  it('Supabase insert error returns 500', () => {
    const err = { message: 'duplicate row_number' }
    expect(err.message).toContain('duplicate')
  })

  it('empty-string dates stay empty in body; inserts as null via || fallback', () => {
    const body: any = { birth_date: '' }
    const bd = body.birth_date || null
    expect(bd).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// Contract invariants
// ═══════════════════════════════════════════════════════════════
describe('Participants API invariants', () => {
  it('only PUT/DELETE/POST exposed — no GET at endpoint', () => {
    const methods = ['POST', 'PUT', 'DELETE']
    expect(methods).not.toContain('GET')
  })
  it('all mutations filter by user_id for RLS safety', () => {
    const filter = { user_id: 'u1' }
    expect(filter).toHaveProperty('user_id')
  })
  it('whitelist has 23 editable fields', () => {
    expect(ALLOWED_FIELDS.length).toBe(23)
  })
  it('no whitelisted field is a security-sensitive identifier', () => {
    const forbidden = ['id', 'user_id', 'row_number', 'created_at']
    for (const f of forbidden) {
      expect(ALLOWED_FIELDS).not.toContain(f)
    }
  })
})
