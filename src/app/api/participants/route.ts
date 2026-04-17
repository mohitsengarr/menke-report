import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/participants
 * Creates a new participant row for the current user.
 * `row_number` auto-assigned as max + 1 if not provided.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  // Auto-assign row_number if not provided
  let rowNumber = Number(body.row_number)
  if (!Number.isFinite(rowNumber) || rowNumber <= 0) {
    const { data: maxRow } = await supabase
      .from('input_data')
      .select('row_number')
      .eq('user_id', user.id)
      .order('row_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    rowNumber = (maxRow?.row_number ?? 0) + 1
  }

  // Build insert payload with sensible defaults
  const toInsert: Record<string, unknown> = {
    user_id: user.id,
    row_number: rowNumber,
    ss_num: body.ss_num ?? null,
    ss_seq: body.ss_seq ?? null,
    name: body.name ?? null,
    loc_no: body.loc_no ?? null,
    div_no: body.div_no ?? null,
    birth_date: body.birth_date || null,
    hire_date: body.hire_date || null,
    esop_date: body.esop_date || null,
    vesting_pct: Number(body.vesting_pct) || 0,
    comp_years: Number(body.comp_years) || 0,
    gender: body.gender ?? null,
    plan_comp: Number(body.plan_comp) || 0,
    emp_group: Number(body.emp_group) || 0,
    divers: Number(body.divers) || 0,
    sra: body.sra ?? null,
    term_date: body.term_date || null,
    reason: body.reason ?? null,
    nonvested: body.nonvested ?? null,
    oia_tranche: Number(body.oia_tranche) || 0,
    total_cash: Number(body.total_cash) || 0,
    stock_tranche: Number(body.stock_tranche) || 0,
    shares: Array.isArray(body.shares)
      ? (body.shares as unknown[]).map(v => Number(v) || 0)
      : new Array(10).fill(0),
    diversifications: Array.isArray(body.diversifications)
      ? (body.diversifications as unknown[]).map(v => Number(v) || 0)
      : new Array(10).fill(0),
    p_diver_years: Array.isArray(body.p_diver_years) ? body.p_diver_years : [],
    p_diver_shares: Array.isArray(body.p_diver_shares)
      ? (body.p_diver_shares as unknown[]).map(v => Number(v) || 0)
      : [],
  }

  const { data, error } = await supabase
    .from('input_data')
    .insert(toInsert)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Participant created', participant: data })
}
