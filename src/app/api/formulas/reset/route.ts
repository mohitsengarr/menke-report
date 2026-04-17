import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/formulas/reset
 * Clears ALL overrides for the current user, reverting every parameter to
 * its code-level default. Writes a batch of audit log rows.
 * Admin-only.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
  }

  // Snapshot current values for audit
  const { data: rows } = await supabase
    .from('formula_configs')
    .select('config_key, value_number, value_text, value_json')
    .eq('user_id', user.id)

  const count = rows?.length ?? 0
  if (count === 0) {
    return NextResponse.json({ success: true, message: 'Already at defaults', resetCount: 0 })
  }

  const { error } = await supabase
    .from('formula_configs')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  // Batch audit rows
  const auditRows = (rows ?? []).map(r => ({
    user_id: user.id,
    config_key: r.config_key,
    previous_value_number: r.value_number,
    previous_value_text: r.value_text,
    previous_value_json: r.value_json,
    new_value_number: null,
    new_value_text: null,
    new_value_json: null,
    action: 'reset' as const,
  }))
  if (auditRows.length > 0) {
    await supabase.from('formula_config_audit').insert(auditRows)
  }

  return NextResponse.json({
    success: true,
    message: `Reset ${count} parameters to defaults`,
    resetCount: count,
  })
}
