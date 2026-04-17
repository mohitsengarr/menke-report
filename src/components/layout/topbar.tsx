'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User } from 'lucide-react'
import type { Profile } from '@/lib/types/database'

export function Topbar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#1B2A4A]">MENKE</span>
            <span className="hidden sm:inline text-xs text-gray-400 border-l pl-2 ml-1">ESOP ADVISORS SINCE 1974</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {profile?.company_name && (
            <span className="hidden md:inline text-sm text-gray-500">{profile.company_name}</span>
          )}

          <div className="relative">
            <button
              onClick={() => {
                const el = document.getElementById('user-dropdown')
                if (el) el.classList.toggle('hidden')
              }}
              className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || 'User'} />
                <AvatarFallback className="bg-[#1B2A4A] text-white text-sm">
                  {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
            <div
              id="user-dropdown"
              className="hidden absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-medium text-gray-900">{profile?.username || 'User'}</p>
                <p className="text-xs text-gray-500">{profile?.email || ''}</p>
              </div>
              <button
                onClick={() => { router.push('/profile'); document.getElementById('user-dropdown')?.classList.add('hidden') }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <User className="h-4 w-4" /> Profile
              </button>
              <div className="border-t" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
