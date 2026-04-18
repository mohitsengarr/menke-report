import { type ReactNode } from 'react'

/**
 * Page transition wrapper.
 *
 * Previously used framer-motion with `initial={{ opacity: 0 }}`, which
 * meant every server-rendered page was sent to the browser at
 * `opacity: 0` and relied on client JS to animate it visible. Any
 * delay, error, or hydration hiccup (see SEN-228) left the entire
 * page invisible while the loading skeleton above stayed mounted —
 * the classic "page stuck on skeleton" symptom.
 *
 * This version is a plain server component that simply passes
 * children through. CSS-only fade-in is applied via the global
 * `page-fade-in` animation class, which uses `animation` (NOT
 * `opacity: 0` initial state) so content is visible even if the
 * animation never plays.
 */
export function PageWrapper({ children }: { children: ReactNode }) {
  return <div className="page-fade-in">{children}</div>
}
