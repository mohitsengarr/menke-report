import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FORMULA_CONFIG_REGISTRY, CONFIG_CATEGORIES } from '@/lib/formulas/config'
import FormulaEditor from './formula-editor'

export const metadata = { title: 'Edit Formula Parameters' }

export default async function FormulasEditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin-only page — members get kicked back to the read-only view
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/formulas')

  const { data: rows } = await supabase
    .from('formula_configs')
    .select('config_key, value_number, value_text, value_json, updated_at')
    .eq('user_id', user.id)

  const overrideMap: Record<string, { value: number | string | null; updated_at: string }> = {}
  for (const r of rows ?? []) {
    const def = FORMULA_CONFIG_REGISTRY.find(d => d.key === r.config_key)
    if (!def) continue
    const val = def.type === 'text' ? r.value_text : r.value_number
    if (val !== null && val !== undefined) {
      overrideMap[r.config_key] = { value: val, updated_at: r.updated_at }
    }
  }

  const { data: auditRows } = await supabase
    .from('formula_config_audit')
    .select('config_key, action, new_value_number, new_value_text, previous_value_number, previous_value_text, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-menke-navy">Edit Formula Parameters</h1>
          <p className="text-sm text-gray-600 mt-1">
            Tune the {FORMULA_CONFIG_REGISTRY.length} admin-editable parameters that drive the
            ESOP calculation engine. Changes apply the next time data is imported or recomputed.
          </p>
        </div>
        <Link
          href="/formulas"
          className="text-sm text-menke-navy hover:underline"
        >
          &larr; Back to documentation
        </Link>
      </div>

      <FormulaEditor
        registry={FORMULA_CONFIG_REGISTRY}
        categories={CONFIG_CATEGORIES as unknown as Array<{ id: string; label: string; color: string }>}
        overrides={overrideMap}
        recentAudit={auditRows ?? []}
      />
    </div>
  )
}
