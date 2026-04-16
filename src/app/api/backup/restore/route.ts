import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TABLE_NAMES = [
  { key: 'valuations', table: 'valuation_projections' },
  { key: 'repurchase', table: 'repurchase_obligations' },
  { key: 'turnover', table: 'share_turnover_schedules' },
  { key: 'population', table: 'population_analyses' },
  { key: 'scores', table: 'success_scores' },
  { key: 'ageTenureActive', table: 'average_age_tenure_active' },
  { key: 'ageTenureTerminated', table: 'average_age_tenure_terminated' },
] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { snapshot_id } = body

    if (!snapshot_id) {
      return NextResponse.json({ success: false, message: 'Missing snapshot_id' }, { status: 400 })
    }

    // Fetch the snapshot
    const { data: snapshot, error: fetchError } = await supabase
      .from('snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !snapshot) {
      return NextResponse.json({ success: false, message: 'Snapshot not found' }, { status: 404 })
    }

    const snapshotData = snapshot.snapshot_data as Record<string, Record<string, unknown>[]>

    // Delete existing data then insert snapshot data for each table
    for (const { key, table } of TABLE_NAMES) {
      const rows = snapshotData[key]
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue

      // Delete existing rows for this user
      await supabase.from(table).delete().eq('user_id', user.id)

      // Strip the id column from each row so Supabase generates new ones,
      // but keep user_id intact
      const cleaned = rows.map((row) => {
        const { id: _id, ...rest } = row
        return { ...rest, user_id: user.id }
      })

      const { error: insertError } = await supabase.from(table).insert(cleaned)
      if (insertError) {
        console.error(`Failed to restore table ${table}:`, insertError)
      }
    }

    // Update last_updated_at on profile
    await supabase.from('profiles').update({
      last_updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return NextResponse.json({ success: true, message: 'Backup restored successfully' })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Restore failed' }, { status: 500 })
  }
}
