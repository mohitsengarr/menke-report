'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, TrendingUp, Users, Award, Settings,
  Upload, Database, History, Info, FileText, UserCircle, Calculator
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  // SEN-203: label now matches destination page title ("Capital Table & Valuation")
  // Fix: child hrefs were swapped — /repurchase is the RO page, /repurchase/share-turnover is the turnover page.
  { label: 'Valuation', href: '/valuation', icon: TrendingUp, children: [
    { label: 'Capital Table & Valuation', href: '/valuation' },
    { label: 'Repurchase Obligation', href: '/repurchase' },
    { label: 'Share Turnover Schedule', href: '/repurchase/share-turnover' },
  ]},
  { label: 'Population', href: '/population', icon: Users, children: [
    { label: 'Population Analysis', href: '/population' },
    { label: 'Population Projection', href: '/population/projection' },
    { label: 'Avg Age & Tenure (Active)', href: '/population/average-age-tenure' },
    { label: 'Avg Age & Tenure (Terminated)', href: '/population/average-balance' },
  ]},
  { label: 'ESOP Success Score', href: '/success-score', icon: Award },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Import Data', href: '/import', icon: Upload },
  { label: 'Data Manage', href: '/manage', icon: Database },
  { label: 'Backup History', href: '/history', icon: History },
  { label: 'Reports', href: '/report', icon: FileText },
  { label: 'About', href: '/about', icon: Info },
  { label: 'Formula Engine', href: '/formulas', icon: Calculator },
]

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()

  return (
    <>
      {/* Overlay for mobile */}
      <div
        id="sidebar-overlay"
        className="hidden fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={() => {
          document.getElementById('mobile-sidebar')?.classList.add('-translate-x-full')
          document.getElementById('mobile-sidebar')?.classList.remove('translate-x-0')
          document.getElementById('sidebar-overlay')?.classList.add('hidden')
        }}
      />
      <aside
        id="mobile-sidebar"
        className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-40 transition-transform duration-200 -translate-x-full md:translate-x-0"
      >
        <motion.nav
          className="p-4 space-y-1"
          initial="initial"
          animate="animate"
          variants={{
            animate: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon
            // Parent is "active" when its own href matches OR any of its children match.
            // Without the child check, clicking a sub-item whose href lives under a
            // different URL segment (e.g. "Repurchase Obligation" at /repurchase from
            // a "Valuation" parent at /valuation) would collapse the whole group
            // because pathname.startsWith('/valuation/') is false for /repurchase.
            const selfActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const anyChildActive = item.children?.some(
              c => pathname === c.href || pathname?.startsWith(c.href + '/')
            ) ?? false
            const groupOpen = !!(selfActive || anyChildActive)

            const closeMobileSidebar = () => {
              document.getElementById('mobile-sidebar')?.classList.add('-translate-x-full')
              document.getElementById('mobile-sidebar')?.classList.remove('translate-x-0')
              document.getElementById('sidebar-overlay')?.classList.add('hidden')
            }

            return (
              <motion.div
                key={item.href}
                variants={{
                  initial: { opacity: 0, x: -15 },
                  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } }
                }}
              >
                <Link
                  href={item.href}
                  onClick={closeMobileSidebar}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    groupOpen
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
                {item.children && groupOpen && (
                  <div className="ml-7 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === child.href || pathname?.startsWith(child.href + '/')
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeMobileSidebar}
                          className={cn(
                            'block px-3 py-1.5 rounded text-xs transition-colors',
                            childActive
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )
          })}

          {profile?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
              </div>
              <Link
                href="/admin"
                onClick={() => {
                  document.getElementById('mobile-sidebar')?.classList.add('-translate-x-full')
                  document.getElementById('mobile-sidebar')?.classList.remove('translate-x-0')
                  document.getElementById('sidebar-overlay')?.classList.add('hidden')
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname?.startsWith('/admin')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <UserCircle className="h-4 w-4" />
                User Management
              </Link>
            </>
          )}

          {/* SEN-210: Footer links */}
          <div className="pt-6 mt-4 border-t border-gray-200">
            <Link
              href="/privacy"
              className="flex items-center gap-3 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Privacy Policy
            </Link>
            <p className="px-3 mt-1 text-[10px] text-gray-400">
              &copy; {new Date().getFullYear()} Menke &amp; Associates
            </p>
          </div>
        </motion.nav>
      </aside>
    </>
  )
}
