'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Snapshot } from '@/lib/types/database'
import { Database, Download, Trash2, Plus, RotateCcw } from 'lucide-react'

export default function HistoryPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSnapshots = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSnapshots(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleCreateBackup = async () => {
    setActionLoading('create')
    setMessage(null)
    try {
      const res = await fetch('/api/backup/create', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        showMessage('success', 'Backup created successfully.')
        fetchSnapshots()
      } else {
        showMessage('error', json.message || 'Failed to create backup.')
      }
    } catch {
      showMessage('error', 'An unexpected error occurred.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestore = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to restore this backup? This will replace your current data.')) return

    setActionLoading(snapshotId)
    setMessage(null)
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_id: snapshotId }),
      })
      const json = await res.json()
      if (json.success) {
        showMessage('success', 'Backup restored successfully.')
      } else {
        showMessage('error', json.message || 'Failed to restore backup.')
      }
    } catch {
      showMessage('error', 'An unexpected error occurred.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) return

    setActionLoading(snapshotId)
    setMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('snapshots')
        .delete()
        .eq('id', snapshotId)

      if (error) throw error

      showMessage('success', 'Backup deleted.')
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId))
    } catch {
      showMessage('error', 'Failed to delete backup.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Backup History</h1>
        <button
          onClick={handleCreateBackup}
          disabled={actionLoading === 'create'}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#243558] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {actionLoading === 'create' ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

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
          <CardTitle>Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-400">Loading backups...</p>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Database className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Backups Yet</h3>
              <p className="text-gray-500 max-w-md">
                Create a backup to save a snapshot of all your analytical data.
                You can restore it at any time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Company Name</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Notes</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        {new Date(snapshot.created_at).toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-2 font-medium">
                        {snapshot.company_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-2 text-gray-500">
                        {snapshot.notes || '-'}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestore(snapshot.id)}
                            disabled={actionLoading === snapshot.id}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                            title="Restore this backup"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </button>
                          <button
                            onClick={() => handleDelete(snapshot.id)}
                            disabled={actionLoading === snapshot.id}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                            title="Delete this backup"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
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
    </div>
  )
}
