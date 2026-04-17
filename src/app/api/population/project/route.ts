import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/population/project
 *
 * Accepts an integer population change rate (-50..+50) and stores it on
 * profiles.inc_rate. The next analytical recompute picks this up and
 * scales projected active participants. Mirrors the legacy
 * `/index/UpdateBaseDatasByPercent?incrate=N` behavior.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let body: { incRate?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const incRate = Number(body.incRate)
  if (!Number.isFinite(incRate) || !Number.isInteger(incRate)) {
    return NextResponse.json(
      { success: false, message: 'incRate must be an integer' }, { status: 400 }
    )
  }
  if (incRate < -50 || incRate > 50) {
    return NextResponse.json(
      { success: false, message: 'incRate must be between -50 and 50' }, { status: 400 }
    )
  }

  const { error } = await supabase
    .from('profiles')
    .update({ inc_rate: incRate })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Population change set to ${incRate >= 0 ? '+' : ''}${incRate}%. Re-import your data or use Sync Data to recompute.`,
    incRate,
  })
}
