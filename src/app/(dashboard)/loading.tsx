/**
 * Dashboard Suspense fallback.
 *
 * Pure server component — NO 'use client', NO framer-motion. Earlier
 * versions wrapped the skeleton in <motion.div initial={{ opacity: 0 }}>
 * which rendered the whole tree at opacity:0 on the server and relied
 * on client JS to animate it visible. If anything delayed client
 * hydration, users saw a blank page with an invisible "skeleton" —
 * the root cause of SEN-228 (P0 skeleton hang). Tailwind's animate-pulse
 * handles the loading shimmer without JavaScript, so hydration state
 * can never leave the fallback invisible.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  )
}
