import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InputData } from '@/lib/types/database'
import { ParticipantSearch } from './participant-search'
import { ManageActions } from './manage-actions'

export const metadata = { title: 'Data Management' }

export default async function ManagePage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) redirect('/login')

  const { data: participants } = await supabase
    .from('input_data')
    .select('*')
    .eq('user_id', user.user.id)
    .order('row_number')

  const rows = (participants ?? []) as InputData[]

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
          <Link
            href="/manage/new"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-menke-navy text-white rounded-md hover:bg-menke-navy-light"
          >
            + New Participant
          </Link>
        </div>
        <ManageActions userId={user.user.id} />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No data available. Please upload your Excel data or add a participant manually.</p>
            <div className="flex justify-center gap-4">
              <Link href="/import" className="text-blue-600 hover:underline font-medium">Import Excel</Link>
              <Link href="/manage/new" className="text-blue-600 hover:underline font-medium">Add Participant</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
        <Link
          href="/manage/new"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-menke-navy text-white rounded-md hover:bg-menke-navy-light"
        >
          + New Participant
        </Link>
      </div>
      <ManageActions userId={user.user.id} />

      <Card>
        <CardHeader>
          <CardTitle>Participants ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ParticipantSearch rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
