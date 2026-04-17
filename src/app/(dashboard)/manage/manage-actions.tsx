'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ManageActions({ userId }: { userId: string }) {
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const supabase = createClient()

  async function handleBackup() {
    setBackupStatus('loading')
    try {
      const res = await fetch('/api/backup/create', { method: 'POST' })
      const data = await res.json()
      setBackupStatus(data.success ? 'success' : 'error')
      setTimeout(() => setBackupStatus('idle'), 3000)
    } catch {
      setBackupStatus('error')
      setTimeout(() => setBackupStatus('idle'), 3000)
    }
  }

  async function handleExport() {
    setExportStatus('loading')
    try {
      const { data } = await supabase.storage
        .from('excel-files')
        .createSignedUrl(`${userId}/current.xlsx`, 60)

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
        setExportStatus('success')
      } else {
        setExportStatus('error')
      }
    } catch {
      setExportStatus('error')
    }
    setTimeout(() => setExportStatus('idle'), 3000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleExport}
        disabled={exportStatus === 'loading'}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {exportStatus === 'loading' ? 'Exporting...' : exportStatus === 'success' ? 'Downloaded!' : 'Export Excel'}
      </button>

      <button
        onClick={handleBackup}
        disabled={backupStatus === 'loading'}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {backupStatus === 'loading' ? 'Creating...' : backupStatus === 'success' ? 'Backup Created!' : 'Create Backup'}
      </button>

      <a
        href="/import"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Import Data
      </a>

      {backupStatus === 'error' && <span className="text-sm text-red-500">Backup failed</span>}
      {exportStatus === 'error' && <span className="text-sm text-red-500">No Excel file found. Upload data first.</span>}
    </div>
  )
}
