'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

type UploadResult = {
  participantCount: number
  companyName: string
} | null

export default function ImportPage() {
  // Section 1: File Upload
  // SEN-221: keep the selected File in React state so the button click after
  // selection doesn't lose the reference across re-renders. The uncontrolled
  // <input type="file"> was dropping its `files` list whenever parent state
  // changed, which made the first Upload click re-open the picker.
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  function pickFile(file: File) {
    // Centralized selection: always update both the display name and the
    // state-held File reference, and wipe any stale status.
    setSelectedFile(file)
    setFileName(file.name)
    setUploadStatus('idle')
    setUploadMessage('')
    setUploadProgress(0)
    setUploadResult(null)
  }

  function clearSelection() {
    setSelectedFile(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Section 1b: Single-Tab Upload
  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [singleFileName, setSingleFileName] = useState('')
  const [singleStatus, setSingleStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [singleMessage, setSingleMessage] = useState('')

  // Section 2: Sync from URL
  const [syncUrl, setSyncUrl] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  // Section 3: Population Change
  const [popChange, setPopChange] = useState<string>('')
  const [popStatus, setPopStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [popMessage, setPopMessage] = useState('')

  async function handleSingleUpload() {
    if (!singleFile) return
    setSingleStatus('uploading')
    setSingleMessage('')

    const formData = new FormData()
    formData.append('file', singleFile)
    formData.append('type', 'single')

    try {
      const res = await fetch('/api/excel/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        setSingleStatus('success')
        setSingleMessage(data.message || 'Single-tab data uploaded successfully.')
      } else {
        setSingleStatus('error')
        setSingleMessage(data.message || 'Upload failed.')
      }
    } catch {
      setSingleStatus('error')
      setSingleMessage('Upload failed. Please try again.')
    }
    setSingleFile(null)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]!
      pickFile(file)
      // Auto-trigger upload on drop, passing the file directly so we don't
      // race with React state updates.
      void handleFileUpload(file)
    }
  }

  async function handleFileUpload(explicit?: File) {
    const file = explicit ?? selectedFile
    if (!file) {
      setUploadStatus('error')
      setUploadMessage('Please select a file first.')
      return
    }

    if (!file.name.endsWith('.xlsx')) {
      setUploadStatus('error')
      setUploadMessage('Only .xlsx files are supported.')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadStatus('error')
      setUploadMessage('File size must be under 50 MB.')
      return
    }

    setUploadStatus('uploading')
    setUploadMessage('')
    setFileName(file.name)
    setUploadProgress(0)

    // Simulate progress increments while uploading
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 200)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/excel/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      const data = await res.json()

      if (res.ok && data.success) {
        setUploadProgress(100)
        setUploadStatus('success')
        setUploadMessage(data.message)
        setUploadResult({
          participantCount: data.participantCount ?? 0,
          companyName: data.companyName ?? 'Unknown',
        })
        // Clear selection so the next upload starts fresh
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setUploadStatus('error')
        setUploadMessage(data.message || 'Upload failed.')
        setUploadProgress(0)
      }
    } catch {
      clearInterval(progressInterval)
      setUploadStatus('error')
      setUploadMessage('Network error. Please check your connection and try again.')
      setUploadProgress(0)
    }
  }

  function handleSync() {
    const trimmed = syncUrl.trim()
    if (!trimmed) {
      setSyncStatus('error')
      setSyncMessage('Please enter a URL.')
      return
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setSyncStatus('error')
      setSyncMessage('URL must start with http:// or https://')
      return
    }

    try {
      new URL(trimmed)
    } catch {
      setSyncStatus('error')
      setSyncMessage('Please enter a valid URL.')
      return
    }

    setSyncStatus('syncing')
    setSyncMessage('')

    // TODO: Phase 3 - Implement actual URL sync endpoint
    setTimeout(() => {
      setSyncStatus('success')
      setSyncMessage('URL sync is not yet implemented. This feature is coming soon.')
    }, 1000)
  }

  async function handlePopulationUpdate() {
    const value = parseFloat(popChange)
    if (isNaN(value) || !Number.isInteger(value)) {
      setPopStatus('error')
      setPopMessage('Please enter a whole number.')
      return
    }
    if (value < -50 || value > 50) {
      setPopStatus('error')
      setPopMessage('Value must be between -50 and 50.')
      return
    }

    try {
      const res = await fetch('/api/population/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incRate: value }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setPopStatus('error')
        setPopMessage(json.message || 'Update failed.')
        return
      }
      setPopStatus('success')
      setPopMessage(json.message || 'Population change applied.')
    } catch (err) {
      setPopStatus('error')
      setPopMessage((err as Error).message)
    }
  }

  function handleExcelExport() {
    // Triggering a download via the API endpoint
    window.location.href = '/api/excel/export'
  }

  // SEN-209 / SEN-211: Sync Data action re-runs the formula engine against
  // existing input_data + current settings without requiring Excel re-upload.
  const [syncDataStatus, setSyncDataStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncDataMessage, setSyncDataMessage] = useState('')
  async function handleSyncData() {
    setSyncDataStatus('syncing')
    setSyncDataMessage('')
    try {
      const res = await fetch('/api/recompute', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setSyncDataStatus('error')
        setSyncDataMessage(json.message || 'Sync failed')
        return
      }
      setSyncDataStatus('success')
      setSyncDataMessage(json.message || 'Analytics recomputed.')
    } catch (err) {
      setSyncDataStatus('error')
      setSyncDataMessage((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Excel Data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your ESOP Excel workbook to populate all reports and projections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncData}
            disabled={syncDataStatus === 'syncing'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-menke-navy text-menke-navy rounded-lg hover:bg-menke-navy/5 disabled:opacity-50"
            title="Recompute analytics with current settings (no re-upload needed)"
          >
            {syncDataStatus === 'syncing' ? 'Syncing…' : 'Sync Data'}
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-menke-navy text-menke-navy rounded-lg hover:bg-menke-navy/5"
            title="Download your current data as an Excel workbook"
          >
            Export to Excel
          </button>
        </div>
      </div>
      {syncDataStatus === 'success' && syncDataMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {syncDataMessage}
        </div>
      )}
      {syncDataStatus === 'error' && syncDataMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {syncDataMessage}
        </div>
      )}

      {/* Hero Section: Upload Full Excel */}
      <Card className="border-2 border-primary/20 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Upload Full Excel</CardTitle>
          <CardDescription>
            Upload a complete .xlsx workbook with all tabs. Maximum file size: 50 MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Drag-and-drop zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragging
                  ? 'border-blue-500 bg-blue-50/70'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-lg font-medium text-gray-700">Drop your .xlsx file here</p>
              <p className="text-sm text-gray-500 mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const picked = e.target.files?.[0]
                  if (picked) pickFile(picked)
                }}
              />
              <p className="text-xs text-gray-400 mt-3">Supported: ESOP workbooks with all tabs. Max 50 MB.</p>
            </div>

            {/* Selected file preview (before upload starts) */}
            {fileName && uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-menke-navy/30 bg-menke-navy/5 px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="h-4 w-4 text-menke-navy shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="font-medium text-menke-navy truncate" title={fileName}>{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearSelection()
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
                  title="Clear selection"
                >
                  Clear
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleFileUpload()}
              disabled={uploadStatus === 'uploading' || !selectedFile}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadStatus === 'uploading' ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload Excel File
                </>
              )}
            </button>

            {/* Progress Bar */}
            {uploadStatus === 'uploading' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading {fileName}...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success / Error Messages */}
            {uploadStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {uploadMessage}
              </div>
            )}
            {uploadStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-400">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {uploadMessage}
              </div>
            )}

            {/* Upload Success Preview */}
            {uploadResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <h3 className="font-medium text-green-800">Upload Successful</h3>
                <p className="text-sm text-green-700 mt-1">
                  Imported {uploadResult.participantCount} participants for {uploadResult.companyName}.
                </p>
                <a href="/dashboard" className="inline-block mt-3 text-sm font-medium text-green-700 hover:text-green-900 underline">
                  View Dashboard &rarr;
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Single-Tab Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Single-Tab Excel</CardTitle>
          <CardDescription>
            Upload an Excel file with just the participant census data (one worksheet).
            This updates participant records without changing plan settings or projections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setSingleFileName(file.name)
                setSingleFile(file)
              }}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <button
              onClick={handleSingleUpload}
              disabled={!singleFile || singleStatus === 'uploading'}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {singleStatus === 'uploading' ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          {singleMessage && (
            <p className={`mt-3 text-sm ${singleStatus === 'success' ? 'text-green-600' : singleStatus === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
              {singleMessage}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Advanced Options Accordion */}
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
          <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Advanced Options
        </summary>

        <div className="space-y-6 mt-4">
          {/* Section 2: Sync from URL */}
          <Card>
            <CardHeader>
              <CardTitle>Sync from URL</CardTitle>
              <CardDescription>
                Provide a direct link to an Excel file hosted online. The file will be downloaded and processed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="url"
                    placeholder="https://example.com/data.xlsx"
                    value={syncUrl}
                    onChange={(e) => {
                      setSyncUrl(e.target.value)
                      setSyncStatus('idle')
                      setSyncMessage('')
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncStatus === 'syncing'}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {syncStatus === 'syncing' ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Sync
                      </>
                    )}
                  </button>
                </div>

                {syncStatus === 'success' && (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {syncMessage}
                  </div>
                )}
                {syncStatus === 'error' && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {syncMessage}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Population Change */}
          <Card>
            <CardHeader>
              <CardTitle>Population Change</CardTitle>
              <CardDescription>
                Adjust the population growth or decline percentage used in projections. Range: -50% to +50%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-40">
                    <input
                      type="number"
                      min={-50}
                      max={50}
                      step={0.1}
                      placeholder="0"
                      value={popChange}
                      onChange={(e) => {
                        setPopChange(e.target.value)
                        setPopStatus('idle')
                        setPopMessage('')
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePopulationUpdate}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.href = '/population/projection'}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
                  >
                    Open Projection Calculator
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the Population Projection page to model growth/decline scenarios and see 10-year projections.
                </p>

                {popStatus === 'success' && (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {popMessage}
                  </div>
                )}
                {popStatus === 'error' && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {popMessage}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  )
}
