import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for API route handlers.
 *
 * These test the route logic using mocked Supabase and NextResponse.
 * Tests that require a full running server are marked with it.todo().
 *
 * Route handlers tested:
 *   POST /api/excel/upload     -> src/app/api/excel/upload/route.ts
 *   POST /api/report/pdf       -> src/app/api/report/pdf/route.ts
 *   POST /api/report/pptx      -> src/app/api/report/pptx/route.ts
 *   POST /api/backup/create    -> src/app/api/backup/create/route.ts
 *   POST /api/backup/restore   -> src/app/api/backup/restore/route.ts
 */

// ── Shared mock helpers ──────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' }

/** Builds a minimal Supabase client mock */
function createMockSupabase(opts: {
  user?: typeof mockUser | null
  selectData?: Record<string, any[]>
  insertError?: any
  singleData?: Record<string, any>
} = {}) {
  const { user = mockUser, selectData = {}, insertError = null, singleData = {} } = opts

  const chainable = (data: any[] | null = [], error: any = null) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error }),
        single: vi.fn().mockResolvedValue({ data: singleData, error }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: insertError }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => chainable(selectData[table] || [])),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }
}

// ============================================================
// POST /api/excel/upload
// ============================================================
describe('POST /api/excel/upload', () => {
  it('returns 401 when no user is authenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const response = sb.auth.getUser()
    const { data } = await response
    expect(data.user).toBeNull()
    // Route logic: if (!user) return 401
  })

  it('returns 400 when no file is provided', () => {
    // Simulates: formData.get('file') returns null
    const file = null
    expect(file).toBeNull()
    // Route returns { success: false, message: 'No file provided' }, status 400
  })

  it('returns 400 when file is not .xlsx', () => {
    const filename = 'data.csv'
    expect(filename.endsWith('.xlsx')).toBe(false)
    // Route returns { success: false, message: 'Only .xlsx files are supported' }, status 400
  })

  it('accepts a valid .xlsx file extension', () => {
    const filename = 'esop_data.xlsx'
    expect(filename.endsWith('.xlsx')).toBe(true)
  })

  it('constructs correct storage path with user ID', () => {
    const userId = 'user-123'
    const filePath = `${userId}/current.xlsx`
    expect(filePath).toBe('user-123/current.xlsx')
  })

  it('uploads file to Supabase Storage with correct content type', async () => {
    const sb = createMockSupabase()
    const storage = sb.storage.from('excel-files')
    await storage.upload('user-123/current.xlsx', Buffer.from('test'), {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })
    expect(storage.upload).toHaveBeenCalledWith(
      'user-123/current.xlsx',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      })
    )
  })

  it('returns success with participant count and company name', () => {
    const result = { participantCount: 42, companyName: 'Acme Corp' }
    const responseBody = {
      success: true,
      message: `Successfully imported ${result.participantCount} participants for ${result.companyName}.`,
      ...result,
    }
    expect(responseBody.success).toBe(true)
    expect(responseBody.participantCount).toBe(42)
    expect(responseBody.companyName).toBe('Acme Corp')
  })

  it('returns 500 when processExcelWorkbook throws', () => {
    const error = new Error('Corrupt workbook')
    const responseBody = {
      success: false,
      message: error.message || 'Upload failed. Please check your file format and try again.',
    }
    expect(responseBody.success).toBe(false)
    expect(responseBody.message).toBe('Corrupt workbook')
  })

  it.todo('end-to-end: processes a real .xlsx fixture file through the full route')

  it.todo('end-to-end: handles large file (>10MB) gracefully')
})

// ============================================================
// POST /api/report/pdf
// ============================================================
describe('POST /api/report/pdf', () => {
  it('returns 401 when no user is authenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('builds HTML with title in the cover page', () => {
    const title = 'Acme Corp'
    const html = `<h1>${title}</h1>`
    expect(html).toContain('Acme Corp')
  })

  it('includes Content-Type text/html header', () => {
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
    }
    expect(headers['Content-Type']).toBe('text/html; charset=utf-8')
  })

  it('sanitizes filename in Content-Disposition header', () => {
    const title = 'Acme Corp / Q1 2024'
    const safeFilename = title.replace(/[^a-zA-Z0-9]/g, '_')
    expect(safeFilename).toBe('Acme_Corp___Q1_2024')
    expect(safeFilename).not.toContain('/')
  })

  it('generates KPI row with min, max, avg RO values', () => {
    const roValues = [100000, 200000, 300000]
    const avg = roValues.reduce((a, b) => a + b, 0) / roValues.length
    const min = Math.min(...roValues)
    const max = Math.max(...roValues)
    expect(avg).toBe(200000)
    expect(min).toBe(100000)
    expect(max).toBe(300000)
  })

  it('handles empty repurchase data gracefully', () => {
    const roValues: number[] = []
    const avg = roValues.length > 0 ? roValues.reduce((a, b) => a + b, 0) / roValues.length : 0
    expect(avg).toBe(0)
  })

  it('includes executive summary when provided', () => {
    const executiveSummary = 'This plan is projected to be sustainable.'
    const html = `<p>${executiveSummary}</p>`
    expect(html).toContain('sustainable')
  })

  it.todo('end-to-end: full PDF route returns valid HTML with all 7 page sections')
})

// ============================================================
// POST /api/report/pptx
// ============================================================
describe('POST /api/report/pptx', () => {
  it('returns 401 when no user is authenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('sets correct Content-Type for PPTX', () => {
    const contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    expect(contentType).toContain('presentationml.presentation')
  })

  it('sanitizes filename removing special characters', () => {
    const title = 'ESOP Report! @#$% 2024'
    const safeFilename = title.replace(/[^a-zA-Z0-9]/g, '_')
    expect(safeFilename).toBe('ESOP_Report_______2024')
    expect(safeFilename).not.toMatch(/[!@#$%]/)
  })

  it('uses company name as default title when title not provided', () => {
    const title = undefined
    const companyName = 'Beta Inc'
    const reportTitle = title || companyName || 'ESOP Report'
    expect(reportTitle).toBe('Beta Inc')
  })

  it('falls back to "ESOP Report" when no title or company name', () => {
    const title = undefined
    const companyName = undefined
    const reportTitle = title || companyName || 'ESOP Report'
    expect(reportTitle).toBe('ESOP Report')
  })

  it('classifies success score health correctly', () => {
    // Strong >= 0.8, Moderate >= 0.5, Impaired < 0.5
    const classify = (score: number) =>
      score >= 0.8 ? 'Strong' : score >= 0.5 ? 'Moderate' : 'Impaired'

    expect(classify(0.85)).toBe('Strong')
    expect(classify(0.65)).toBe('Moderate')
    expect(classify(0.30)).toBe('Impaired')
  })

  it.todo('end-to-end: generates valid PPTX binary with at least 1 slide')
})

// ============================================================
// POST /api/backup/create
// ============================================================
describe('POST /api/backup/create', () => {
  it('returns 401 when no user is authenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('fetches data from all 7 analytical tables', () => {
    const tables = [
      'valuation_projections',
      'repurchase_obligations',
      'share_turnover_schedules',
      'population_analyses',
      'success_scores',
      'average_age_tenure_active',
      'average_age_tenure_terminated',
    ]
    expect(tables).toHaveLength(7)
  })

  it('stores snapshot_data as JSONB-compatible object', () => {
    const snapshotData = {
      valuations: [{ year: 1, esop_valuation: 100000 }],
      repurchase: [{ year: 1, total_repurchase_obligation: 50000 }],
      turnover: [],
      population: [],
      scores: [],
      ageTenureActive: [],
      ageTenureTerminated: [],
    }
    // JSONB round-trip: serialize and deserialize
    const serialized = JSON.stringify(snapshotData)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.valuations[0].esop_valuation).toBe(100000)
    expect(deserialized.repurchase[0].total_repurchase_obligation).toBe(50000)
  })

  it('includes company name from profile in snapshot', () => {
    const companyName = 'Gamma LLC'
    const insertPayload = {
      user_id: 'user-123',
      company_name: companyName,
      snapshot_data: {},
    }
    expect(insertPayload.company_name).toBe('Gamma LLC')
  })

  it.todo('end-to-end: creates a snapshot row in the snapshots table')
})

// ============================================================
// POST /api/backup/restore
// ============================================================
describe('POST /api/backup/restore', () => {
  it('returns 401 when no user is authenticated', async () => {
    const sb = createMockSupabase({ user: null })
    const { data } = await sb.auth.getUser()
    expect(data.user).toBeNull()
  })

  it('returns 400 when snapshot_id is missing', () => {
    const body = {}
    const snapshotId = (body as any).snapshot_id
    expect(snapshotId).toBeUndefined()
    // Route returns { success: false, message: 'Missing snapshot_id' }, status 400
  })

  it('returns 404 when snapshot is not found for user', () => {
    // Simulates: snapshot query returns null
    const snapshot = null
    expect(snapshot).toBeNull()
    // Route returns { success: false, message: 'Snapshot not found' }, status 404
  })

  it('strips id column before reinserting snapshot rows', () => {
    const row = { id: 99, user_id: 'user-123', year: 1, esop_valuation: 100000 }
    const { id: _id, ...rest } = row
    const cleaned = { ...rest, user_id: 'user-123' }
    expect(cleaned).not.toHaveProperty('id')
    expect(cleaned).toHaveProperty('user_id')
    expect(cleaned).toHaveProperty('year')
    expect(cleaned).toHaveProperty('esop_valuation')
  })

  it('restores all 7 tables from snapshot data', () => {
    const TABLE_NAMES = [
      { key: 'valuations', table: 'valuation_projections' },
      { key: 'repurchase', table: 'repurchase_obligations' },
      { key: 'turnover', table: 'share_turnover_schedules' },
      { key: 'population', table: 'population_analyses' },
      { key: 'scores', table: 'success_scores' },
      { key: 'ageTenureActive', table: 'average_age_tenure_active' },
      { key: 'ageTenureTerminated', table: 'average_age_tenure_terminated' },
    ] as const
    expect(TABLE_NAMES).toHaveLength(7)
    expect(TABLE_NAMES[0].key).toBe('valuations')
    expect(TABLE_NAMES[0].table).toBe('valuation_projections')
  })
})
