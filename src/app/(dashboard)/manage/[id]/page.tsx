import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InputData } from '@/lib/types/database'
import ParticipantForm from './participant-form'

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // SEN-208: /manage/new renders an empty form for manual participant entry.
  if (id === 'new') {
    const emptyParticipant: InputData = {
      id: '',
      user_id: '',
      row_number: 0,
      ss_num: null,
      ss_seq: null,
      name: null,
      loc_no: null,
      div_no: null,
      birth_date: null,
      hire_date: null,
      esop_date: null,
      vesting_pct: 0,
      comp_years: 0,
      gender: null,
      plan_comp: 0,
      emp_group: 0,
      divers: 0,
      sra: null,
      term_date: null,
      reason: null,
      nonvested: null,
      oia_tranche: 0,
      total_cash: 0,
      stock_tranche: 0,
      shares: new Array(10).fill(0),
      diversifications: new Array(10).fill(0),
      p_diver_years: [],
      p_diver_shares: [],
    }
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/manage" className="text-blue-600 hover:underline text-sm">&larr; Back to list</Link>
          <h1 className="text-2xl font-bold text-gray-900">New Participant</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>Enter Participant Details</CardTitle></CardHeader>
          <CardContent>
            <ParticipantForm participant={emptyParticipant} isNew />
          </CardContent>
        </Card>
      </div>
    )
  }

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/manage" className="text-blue-600 hover:underline text-sm">&larr; Back to list</Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {row.name ?? `Participant #${row.row_number}`}
        </h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Participant Details</CardTitle></CardHeader>
        <CardContent>
          <ParticipantForm participant={row} />
        </CardContent>
      </Card>
    </div>
  )
}
