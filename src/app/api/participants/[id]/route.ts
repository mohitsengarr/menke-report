import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * PUT /api/participants/[id]
 * Updates a single participant row. `id` is the row_number.
 * Only fields present in the body are updated.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const rowNumber = parseInt(idParam, 10)
  if (isNaN(rowNumber)) {
    return NextResponse.json({ success: false, message: 'Invalid participant id' }, { status: 400 })
  }

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

  // Whitelist editable fields (no user_id, id, row_number changes)
  const ALLOWED = [
    'ss_num', 'ss_seq', 'name', 'loc_no', 'div_no',
    'birth_date', 'hire_date', 'esop_date',
    'vesting_pct', 'comp_years', 'gender', 'plan_comp',
    'emp_group', 'divers', 'sra', 'term_date', 'reason', 'nonvested',
    'oia_tranche', 'total_cash', 'stock_tranche',
    'shares', 'diversifications',
  ]
  const update: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, message: 'No editable fields in body' }, { status: 400 })
  }

  // Normalize empty-string dates to null
  for (const dateField of ['birth_date', 'hire_date', 'esop_date', 'term_date']) {
    if (update[dateField] === '') update[dateField] = null
  }
  // Coerce numeric fields
  for (const numField of ['vesting_pct', 'comp_years', 'plan_comp', 'emp_group', 'divers', 'oia_tranche', 'total_cash', 'stock_tranche']) {
    if (update[numField] !== undefined && update[numField] !== null) {
      const n = Number(update[numField])
      if (!Number.isFinite(n)) {
        return NextResponse.json({ success: false, message: `${numField} must be a number` }, { status: 400 })
      }
      update[numField] = n
    }
  }
  // Coerce shares/diversifications to number arrays
  for (const arrField of ['shares', 'diversifications']) {
    if (update[arrField] !== undefined) {
      if (!Array.isArray(update[arrField])) {
        return NextResponse.json({ success: false, message: `${arrField} must be an array` }, { status: 400 })
      }
      update[arrField] = (update[arrField] as unknown[]).map(v => Number(v) || 0)
    }
  }

  const { data, error } = await supabase
    .from('input_data')
    .update(update)
    .eq('user_id', user.id)
    .eq('row_number', rowNumber)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ success: false, message: 'Participant not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, message: 'Participant updated', participant: data })
}

/**
 * DELETE /api/participants/[id]
 * Removes a single participant row.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const rowNumber = parseInt(idParam, 10)
  if (isNaN(rowNumber)) {
    return NextResponse.json({ success: false, message: 'Invalid participant id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('input_data')
    .delete()
    .eq('user_id', user.id)
    .eq('row_number', rowNumber)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Participant deleted' })
}
