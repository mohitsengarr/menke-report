'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/lib/types/database'
import { Shield, ShieldOff, UserCheck, UserX, Users } from 'lucide-react'

export default function AdminUserTable({ profiles: initialProfiles }: { profiles: Profile[] }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleToggleStatus = async (profile: Profile) => {
    const newStatus = profile.status === 'active' ? 'inactive' : 'active'
    setActionLoading(`status-${profile.id}`)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', profile.id)

      if (error) throw error

      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, status: newStatus } : p))
      )
      showMessage('success', `${profile.username || profile.email} is now ${newStatus}.`)
    } catch {
      showMessage('error', 'Failed to update status.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleRole = async (profile: Profile) => {
    const newRole = profile.role === 'admin' ? 'member' : 'admin'
    setActionLoading(`role-${profile.id}`)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profile.id)

      if (error) throw error

      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, role: newRole } : p))
      )
      showMessage('success', `${profile.username || profile.email} role changed to ${newRole}.`)
    } catch {
      showMessage('error', 'Failed to update role.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <CardTitle>All Users ({profiles.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Username</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Email</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Role</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">
                        {profile.username || '-'}
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {profile.email}
                      </td>
                      <td className="py-3 px-2">
                        {profile.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            Member
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {profile.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(profile)}
                            disabled={actionLoading === `status-${profile.id}`}
                            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              profile.status === 'active'
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                            title={profile.status === 'active' ? 'Deactivate user' : 'Activate user'}
                          >
                            {profile.status === 'active' ? (
                              <>
                                <UserX className="h-3 w-3" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3" />
                                Activate
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleRole(profile)}
                            disabled={actionLoading === `role-${profile.id}`}
                            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              profile.role === 'admin'
                                ? 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                                : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                            }`}
                            title={profile.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                          >
                            {profile.role === 'admin' ? (
                              <>
                                <ShieldOff className="h-3 w-3" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-3 w-3" />
                                Make Admin
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
