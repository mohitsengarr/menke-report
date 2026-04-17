'use client'

import { useEffect } from 'react'

/**
 * Root-level global error boundary.
 *
 * Per Next.js App Router conventions, `global-error.tsx` replaces the
 * root layout when a catastrophic error (including one in the root
 * layout itself) is thrown — therefore it MUST include its own
 * `<html>` and `<body>` elements.
 *
 * Page-specific errors fall through to the scoped `(dashboard)/error.tsx`
 * or any other nearer error boundary first. This handler is only
 * invoked for truly root-level failures (e.g., missing auth env vars,
 * middleware crash).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global root error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f9fafb',
        color: '#111827',
      }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            <p style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#dc2626',
              margin: 0,
            }}>
              Application Error
            </p>
            <h1 style={{
              marginTop: '1rem',
              fontSize: '1.875rem',
              fontWeight: 700,
              color: '#111827',
            }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#4b5563' }}>
              The application hit an unrecoverable error. Please try again, or head back to the
              home page.
            </p>
            {error.digest && (
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}>
                Reference: {error.digest}
              </p>
            )}
            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#1e3a8a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/login"
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  backgroundColor: 'white',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Sign in
              </a>
            </div>
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
              &copy; {new Date().getFullYear()} Menke &amp; Associates. ESOP Advisors Since 1974.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
