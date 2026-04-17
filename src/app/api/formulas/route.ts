import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  FORMULA_CONFIG_REGISTRY,
  getConfigDef,
  validateConfigValue,
} from '@/lib/formulas/config'

/**
 * GET /api/formulas
 * Returns the full registry of formula parameters merged with the current
 * user's overrides. Shape:
 *   { registry: FormulaConfigDef[], overrides: Record<key, current_value> }
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows } = await supabase
    .from('formula_configs')
    .select('config_key, value_number, value_text, value_json, updated_at')
    .eq('user_id', user.id)

  const overrideMap: Record<string, { value: number | string | unknown; updated_at: string }> = {}
  for (const r of rows ?? []) {
    const def = FORMULA_CONFIG_REGISTRY.find(d => d.key === r.config_key)
    if (!def) continue
    const val = def.type === 'text'
      ? r.value_text
      : def.type === 'json'
        ? r.value_json
        : r.value_number
    if (val !== null && val !== undefined) {
      overrideMap[r.config_key] = { value: val, updated_at: r.updated_at }
    }
  }

  return NextResponse.json({
    success: true,
    registry: FORMULA_CONFIG_REGISTRY,
    overrides: overrideMap,
  })
}

/**
 * PUT /api/formulas
 * Body: { key: string, value: number | string }
 * Creates or updates a single override for the current user.
 * Writes an audit log row.
 */
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can tune engine parameters
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
  }

  let body: { key?: string; value?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const key = body.key
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ success: false, message: 'key required' }, { status: 400 })
  }

  let def
  try {
    def = getConfigDef(key)
  } catch {
    return NextResponse.json({ success: false, message: `Unknown config key: ${key}` }, { status: 400 })
  }

  const validation = validateConfigValue(def, body.value)
  if (!validation.ok) {
    return NextResponse.json({ success: false, message: validation.error }, { status: 400 })
  }

  // Read current value for audit
  const { data: existing } = await supabase
    .from('formula_configs')
    .select('value_number, value_text, value_json')
    .eq('user_id', user.id)
    .eq('config_key', key)
    .maybeSingle()

  const value_number = (def.type === 'number' || def.type === 'percentage' || def.type === 'integer')
    ? Number(body.value) : null
  const value_text = def.type === 'text' ? String(body.value) : null
  const value_json = def.type === 'json' ? body.value : null

  const { error: upsertError } = await supabase
    .from('formula_configs')
    .upsert({
      user_id: user.id,
      config_key: key,
      value_number,
      value_text,
      value_json,
      value_type: def.type,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,config_key' })

  if (upsertError) {
    return NextResponse.json({ success: false, message: upsertError.message }, { status: 500 })
  }

  // Write audit log (best-effort; don't fail the user if this fails)
  await supabase.from('formula_config_audit').insert({
    user_id: user.id,
    config_key: key,
    previous_value_number: existing?.value_number ?? null,
    previous_value_text: existing?.value_text ?? null,
    previous_value_json: existing?.value_json ?? null,
    new_value_number: value_number,
    new_value_text: value_text,
    new_value_json: value_json,
    action: existing ? 'update' : 'create',
  })

  return NextResponse.json({
    success: true,
    message: `Updated ${def.label}`,
    key,
    value: body.value,
  })
}

/**
 * DELETE /api/formulas?key=...
 * Clears the user's override for a given key, reverting to the default.
 * Writes an audit log row.
 */
export async function DELETE(request: Request) {
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

  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ success: false, message: 'key required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('formula_configs')
    .select('value_number, value_text, value_json')
    .eq('user_id', user.id)
    .eq('config_key', key)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ success: true, message: 'Already at default' })
  }

  const { error } = await supabase
    .from('formula_configs')
    .delete()
    .eq('user_id', user.id)
    .eq('config_key', key)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  await supabase.from('formula_config_audit').insert({
    user_id: user.id,
    config_key: key,
    previous_value_number: existing.value_number,
    previous_value_text: existing.value_text,
    previous_value_json: existing.value_json,
    new_value_number: null,
    new_value_text: null,
    new_value_json: null,
    action: 'reset',
  })

  return NextResponse.json({ success: true, message: 'Reset to default', key })
}
