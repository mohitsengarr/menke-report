'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Dashboard-scoped error boundary. Catches any uncaught error thrown by
 * a dashboard page so a single-page regression can't freeze the rest of
 * the app on its loading skeleton (SEN-212).
 *
 * Per Next.js App Router conventions, this file wraps every page under
 * the (dashboard) route group but does NOT wrap the dashboard layout
 * itself. If the layout throws, the next-higher error boundary
 * (src/app/global-error.tsx) takes over.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard page error:', error)
  }, [error])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
          Something went wrong on this page
        </p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">
          Unable to render this view.
        </h1>
        <p className="mt-2 text-sm text-gray-700">
          The page hit an error while loading. You can try again, head back to the dashboard,
          or run a data sync to recompute analytics.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-gray-500 font-mono">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-menke-navy text-white rounded-md hover:bg-menke-navy-light"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/import"
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
          >
            Import / Sync Data
          </Link>
        </div>
      </div>
    </div>
  )
}
