import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin-gated user mutation endpoint.
 *
 * PATCH /api/admin/user/[id]
 * Body: one of:
 *   { action: 'toggle_status' }
 *   { action: 'set_status', status: 'active' | 'inactive' }
 *   { action: 'toggle_role' }
 *   { action: 'set_role', role: 'admin' | 'member' }
 *   { action: 'reset_password' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  // Admin guard
  const { data: currentProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (currentProfile?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body.action ?? '')

  // Load target profile
  const { data: target, error: fetchErr } = await supabase
    .from('profiles').select('*').eq('id', targetId).single()
  if (fetchErr || !target) {
    return NextResponse.json({ success: false, message: 'Target user not found' }, { status: 404 })
  }

  // Self-protection: don't let an admin demote/deactivate themselves (avoid lockout)
  if (target.id === user.id && (action === 'toggle_status' || action === 'set_status' || action === 'toggle_role' || action === 'set_role')) {
    return NextResponse.json({
      success: false,
      message: 'You cannot change your own role or status — ask another admin.',
    }, { status: 400 })
  }

  if (action === 'toggle_status' || action === 'set_status') {
    let newStatus: string
    if (action === 'set_status') {
      newStatus = String(body.status)
      if (newStatus !== 'active' && newStatus !== 'inactive') {
        return NextResponse.json({ success: false, message: 'status must be active or inactive' }, { status: 400 })
      }
    } else {
      newStatus = target.status === 'active' ? 'inactive' : 'active'
    }
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', targetId)
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      message: `${target.username || target.email} is now ${newStatus}.`,
      status: newStatus,
    })
  }

  if (action === 'toggle_role' || action === 'set_role') {
    let newRole: string
    if (action === 'set_role') {
      newRole = String(body.role)
      if (newRole !== 'admin' && newRole !== 'member') {
        return NextResponse.json({ success: false, message: 'role must be admin or member' }, { status: 400 })
      }
    } else {
      newRole = target.role === 'admin' ? 'member' : 'admin'
    }
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', targetId)
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      message: `${target.username || target.email} role changed to ${newRole}.`,
      role: newRole,
    })
  }

  if (action === 'reset_password') {
    if (!target.email) {
      return NextResponse.json({ success: false, message: 'Target user has no email on file' }, { status: 400 })
    }
    // Build a redirect URL based on request origin
    const origin = new URL(request.url).origin
    const redirectTo = `${origin}/login?reset=1`
    const { error } = await supabase.auth.resetPasswordForEmail(target.email, { redirectTo })
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      message: `Password-reset email sent to ${target.email}.`,
    })
  }

  return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 })
}
