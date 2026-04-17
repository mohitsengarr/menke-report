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
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploadResult, setUploadResult] = useState<UploadResult>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Section 2: Sync from URL
  const [syncUrl, setSyncUrl] = useState('')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  // Section 3: Population Change
  const [popChange, setPopChange] = useState<string>('')
  const [popStatus, setPopStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [popMessage, setPopMessage] = useState('')

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0]
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
        // Reset file input
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

  function handlePopulationUpdate() {
    const value = parseFloat(popChange)
    if (isNaN(value)) {
      setPopStatus('error')
      setPopMessage('Please enter a valid number.')
      return
    }

    if (value < -50 || value > 50) {
      setPopStatus('error')
      setPopMessage('Value must be between -50 and 50.')
      return
    }

    setPopStatus('idle')
    setPopMessage('')

    // TODO: Phase 3 - Implement population change update via API
    setTimeout(() => {
      setPopStatus('success')
      setPopMessage(`Population change set to ${value}%. Update processing coming soon.`)
    }, 500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Excel Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your ESOP Excel workbook to populate all reports and projections.
        </p>
      </div>

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
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:rounded-md file:border-0
                  file:bg-primary file:px-4 file:py-2
                  file:text-sm file:font-medium file:text-primary-foreground
                  file:cursor-pointer hover:file:bg-primary/90
                  file:transition-colors"
                onChange={() => {
                  setUploadStatus('idle')
                  setUploadMessage('')
                  setUploadProgress(0)
                  setUploadResult(null)
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleFileUpload}
              disabled={uploadStatus === 'uploading'}
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
                </div>

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
