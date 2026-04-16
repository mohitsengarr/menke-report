import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminUserTable from './admin-user-table'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check admin role
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch all profiles (admin RLS policy allows this)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard &mdash; User Management</h1>
      <AdminUserTable profiles={profiles || []} />
    </div>
  )
}
