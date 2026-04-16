import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InputData } from '@/lib/types/database'

type FieldDef = { label: string; value: string | number | null }

function formatField(row: InputData): FieldDef[] {
  return [
    { label: 'Row Number', value: row.row_number },
    { label: 'Name', value: row.name },
    { label: 'SS Num', value: row.ss_num },
    { label: 'SS Seq', value: row.ss_seq },
    { label: 'Location No', value: row.loc_no },
    { label: 'Division No', value: row.div_no },
    { label: 'Birth Date', value: row.birth_date },
    { label: 'Hire Date', value: row.hire_date },
    { label: 'ESOP Date', value: row.esop_date },
    { label: 'Vesting %', value: `${(row.vesting_pct * 100).toFixed(0)}%` },
    { label: 'Comp Years', value: row.comp_years },
    { label: 'Gender', value: row.gender },
    { label: 'Plan Comp', value: `$${row.plan_comp.toLocaleString()}` },
    { label: 'Employee Group', value: row.emp_group },
    { label: 'Diversification', value: row.divers },
    { label: 'SRA', value: row.sra },
    { label: 'Term Date', value: row.term_date },
    { label: 'Reason', value: row.reason },
    { label: 'Non-Vested', value: row.nonvested },
    { label: 'OIA Tranche', value: row.oia_tranche.toLocaleString() },
    { label: 'Total Cash', value: `$${row.total_cash.toLocaleString()}` },
    { label: 'Stock Tranche', value: row.stock_tranche.toLocaleString() },
  ]
}

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rowNumber = parseInt(id, 10)
  if (isNaN(rowNumber)) notFound()

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null

  const { data: rows } = await supabase
    .from('input_data')
    .select('*')
    .eq('user_id', user.user.id)
    .eq('row_number', rowNumber)
    .limit(1)

  const row = (rows?.[0] ?? null) as InputData | null
  if (!row) notFound()

  const fields = formatField(row)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manage" className="text-blue-600 hover:underline text-sm">&larr; Back to list</Link>
        <h1 className="text-2xl font-bold text-gray-900">{row.name ?? `Participant #${row.row_number}`}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Participant Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.label} className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-wide">{f.label}</span>
                <span className="text-sm font-medium text-gray-900 mt-0.5">{f.value ?? '---'}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {row.shares && row.shares.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Share Allocations</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {row.shares.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 rounded text-sm">{s.toLocaleString()}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
