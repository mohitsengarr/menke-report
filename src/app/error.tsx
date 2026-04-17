'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Global error boundary — catches unhandled render errors in the app tree.
 * Next.js will automatically render this in place of the crashed page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log client-side so the user sees something in the console, server
    // telemetry should be configured separately.
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">Error</p>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-3 text-sm text-gray-600">
          We&apos;ve logged the error. Try again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-gray-400 font-mono">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center px-4 py-2 bg-menke-navy text-white text-sm font-medium rounded-md hover:bg-menke-navy-light"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100"
          >
            Back to Dashboard
          </Link>
        </div>
        <p className="mt-8 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Menke &amp; Associates. ESOP Advisors Since 1974.
        </p>
      </div>
    </div>
  )
}
