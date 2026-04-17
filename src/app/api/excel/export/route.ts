import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/excel/export
 *
 * Builds a fresh .xlsx file containing every current-state table for
 * the authenticated user so the user can download their data or hand
 * it off to a consultant. Mirrors the legacy `/ImportExcel/ExportFile`
 * endpoint but with our expanded schema.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const [
    profileRes, inputRes, provisionsRes, allocationsRes, distributionsRes,
    fundingRes, valuationRes, sharePricesRes,
    valuationProjectionsRes, repurchaseRes, shareTurnoverRes,
    populationRes, successRes, ageActiveRes, ageTermRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('input_data').select('*').eq('user_id', user.id).order('row_number'),
    supabase.from('plan_provisions').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('allocations').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('distributions').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('funding').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('valuation_inputs').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('beginning_share_prices').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('valuation_projections').select('*').eq('user_id', user.id).order('year'),
    supabase.from('repurchase_obligations').select('*').eq('user_id', user.id).order('year'),
    supabase.from('share_turnover_schedules').select('*').eq('user_id', user.id).order('year'),
    supabase.from('population_analyses').select('*').eq('user_id', user.id).order('year'),
    supabase.from('success_scores').select('*').eq('user_id', user.id).order('year_for_payout'),
    supabase.from('average_age_tenure_active').select('*').eq('user_id', user.id),
    supabase.from('average_age_tenure_terminated').select('*').eq('user_id', user.id),
  ])

  const companyName = profileRes.data?.company_name || profileRes.data?.username || 'My ESOP Plan'

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Menke Report'
  wb.created = new Date()

  // ── Tab 1: Participants ──
  const p = wb.addWorksheet('Participants')
  p.getCell('A1').value = companyName
  p.getCell('A1').font = { bold: true, size: 14 }
  const participantHeaders = [
    'Row', 'SSN', 'SS Seq', 'Name', 'Location', 'Division',
    'Birth Date', 'Hire Date', 'ESOP Date',
    'Vesting %', 'Comp Years', 'Gender', 'Plan Comp',
    'Emp Group', 'Divers Elected', 'SRA',
    'Term Date', 'Reason', 'Non-Vested',
    'OIA Tranche', 'Total Cash', 'Stock Tranche',
    'Yr 1 Shares', 'Yr 2 Shares', 'Yr 3 Shares', 'Yr 4 Shares', 'Yr 5 Shares',
    'Yr 6 Shares', 'Yr 7 Shares', 'Yr 8 Shares', 'Yr 9 Shares', 'Yr 10 Shares',
  ]
  p.addRow([])
  const headerRow = p.addRow(participantHeaders)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  headerRow.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } } })

  for (const row of inputRes.data ?? []) {
    const shares = row.shares ?? []
    const paddedShares = [...shares, ...new Array(Math.max(0, 10 - shares.length)).fill(0)]
    p.addRow([
      row.row_number, row.ss_num, row.ss_seq, row.name, row.loc_no, row.div_no,
      row.birth_date, row.hire_date, row.esop_date,
      row.vesting_pct, row.comp_years, row.gender, row.plan_comp,
      row.emp_group, row.divers, row.sra,
      row.term_date, row.reason, row.nonvested,
      row.oia_tranche, row.total_cash, row.stock_tranche,
      ...paddedShares.slice(0, 10),
    ])
  }

  // ── Tab 2: Settings ──
  const s = wb.addWorksheet('Settings')
  const appendSection = (title: string, rows: Array<[string, unknown]>) => {
    const sectionHeader = s.addRow([title])
    sectionHeader.font = { bold: true, size: 12 }
    for (const [k, v] of rows) s.addRow([k, v ?? ''])
    s.addRow([])
  }

  if (provisionsRes.data) {
    appendSection('Plan Provisions', Object.entries(provisionsRes.data).filter(([k]) => k !== 'id' && k !== 'user_id'))
  }
  if (allocationsRes.data) {
    appendSection('Allocations', Object.entries(allocationsRes.data).filter(([k]) => k !== 'id' && k !== 'user_id'))
  }
  if (distributionsRes.data) {
    appendSection('Distributions', Object.entries(distributionsRes.data).filter(([k]) => k !== 'id' && k !== 'user_id'))
  }
  if (fundingRes.data) {
    appendSection('Funding', Object.entries(fundingRes.data).filter(([k]) => k !== 'id' && k !== 'user_id'))
  }
  if (valuationRes.data) {
    appendSection('Valuation Inputs', Object.entries(valuationRes.data).filter(([k]) => k !== 'id' && k !== 'user_id'))
  }
  if (sharePricesRes.data) {
    appendSection('Beginning Share Prices', Object.entries(sharePricesRes.data).filter(([k]) => k !== 'id' && k !== 'user_id'))
  }

  // ── Tab 3: Computed Outputs ──
  const o = wb.addWorksheet('Computed Outputs')
  const addTable = (title: string, rows: Array<Record<string, unknown>> | null) => {
    const titleRow = o.addRow([title])
    titleRow.font = { bold: true, size: 12 }
    if (!rows || rows.length === 0) {
      o.addRow(['(no data)'])
      o.addRow([])
      return
    }
    const keys = Object.keys(rows[0]!).filter(k => k !== 'id' && k !== 'user_id')
    const headerR = o.addRow(keys)
    headerR.font = { bold: true }
    for (const r of rows) {
      o.addRow(keys.map(k => r[k]))
    }
    o.addRow([])
  }

  addTable('Valuation Projections', valuationProjectionsRes.data)
  addTable('Repurchase Obligations', repurchaseRes.data)
  addTable('Share Turnover Schedule', shareTurnoverRes.data)
  addTable('Population Analysis', populationRes.data)
  addTable('Success Scores', successRes.data)
  addTable('Age & Tenure — Active', ageActiveRes.data)
  addTable('Age & Tenure — Terminated', ageTermRes.data)

  const buffer = await wb.xlsx.writeBuffer()

  // Sanitize filename
  const safeName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
  const datePart = new Date().toISOString().slice(0, 10)
  const filename = `menke-export-${safeName}-${datePart}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
