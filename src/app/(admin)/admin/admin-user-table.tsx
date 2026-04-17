'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/lib/types/database'
import { Shield, ShieldOff, UserCheck, UserX, Users, KeyRound } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminUserTable({ profiles: initialProfiles }: { profiles: Profile[] }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function callAdminApi(profile: Profile, body: Record<string, unknown>, loadingKey: string) {
    setActionLoading(loadingKey)
    try {
      const res = await fetch(`/api/admin/user/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        showMessage('error', json.message || 'Action failed')
        return null
      }
      showMessage('success', json.message || 'Done')
      return json
    } catch (err) {
      showMessage('error', (err as Error).message)
      return null
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async (profile: Profile) => {
    const result = await callAdminApi(profile, { action: 'toggle_status' }, `status-${profile.id}`)
    if (result?.status) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, status: result.status } : p))
    }
  }

  const handleToggleRole = async (profile: Profile) => {
    const result = await callAdminApi(profile, { action: 'toggle_role' }, `role-${profile.id}`)
    if (result?.role) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: result.role } : p))
    }
  }

  const handleResetPassword = async (profile: Profile) => {
    setResetTarget(null)
    await callAdminApi(profile, { action: 'reset_password' }, `reset-${profile.id}`)
  }

  return (
    <>
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-lg px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-800'
                : 'border border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

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
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
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
                            type="button"
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
                          <button
                            type="button"
                            onClick={() => setResetTarget(profile)}
                            disabled={actionLoading === `reset-${profile.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            title="Send password-reset email"
                          >
                            <KeyRound className="h-3 w-3" />
                            Reset Password
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

      {/* Reset password confirmation */}
      <AnimatePresence>
        {resetTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setResetTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-semibold text-menke-navy">Send password-reset email?</h3>
              <p className="mt-2 text-sm text-gray-600">
                A password-reset link will be sent to <strong>{resetTarget.email}</strong>.
                The user must click the link to choose a new password.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(resetTarget)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send email
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
