import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <img src="/menke-logo.png" alt="Menke & Associates" className="h-12 mb-6" />
      <h1 className="text-6xl font-bold text-menke-navy mb-4">404</h1>
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Page Not Found</h2>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="px-6 py-3 bg-menke-navy text-white rounded-lg hover:bg-menke-navy-light transition-colors font-medium"
      >
        Return to Dashboard
      </Link>
      <p className="text-xs text-gray-400 mt-8">&copy; {new Date().getFullYear()} Menke &amp; Associates. ESOP Advisors Since 1974.</p>
    </div>
  )
}
