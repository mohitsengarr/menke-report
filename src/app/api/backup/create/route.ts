import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch all analytical data
    const [valuations, repurchase, turnover, population, scores, ageTenureActive, ageTenureTerminated] = await Promise.all([
      supabase.from('valuation_projections').select('*').eq('user_id', user.id),
      supabase.from('repurchase_obligations').select('*').eq('user_id', user.id),
      supabase.from('share_turnover_schedules').select('*').eq('user_id', user.id),
      supabase.from('population_analyses').select('*').eq('user_id', user.id),
      supabase.from('success_scores').select('*').eq('user_id', user.id),
      supabase.from('average_age_tenure_active').select('*').eq('user_id', user.id),
      supabase.from('average_age_tenure_terminated').select('*').eq('user_id', user.id),
    ])

    // Get company name (fall back to username, then a friendly default — SEN-196)
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, username')
      .eq('id', user.id)
      .single()
    const companyName = (profile?.company_name && profile.company_name.trim())
      || profile?.username
      || 'My ESOP Plan'

    const snapshotData = {
      valuations: valuations.data,
      repurchase: repurchase.data,
      turnover: turnover.data,
      population: population.data,
      scores: scores.data,
      ageTenureActive: ageTenureActive.data,
      ageTenureTerminated: ageTenureTerminated.data,
    }

    const { error } = await supabase.from('snapshots').insert({
      user_id: user.id,
      company_name: companyName,
      snapshot_data: snapshotData,
    })

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Backup created successfully' })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Backup creation failed' }, { status: 500 })
  }
}
