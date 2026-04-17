'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Profile } from '@/lib/types/database'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoadingProfile(true)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          setLoadError('You must be signed in to view your profile.')
          return
        }
        const { data, error } = await supabase
          .from('profiles').select('*').eq('id', user.id).single()
        if (error || !data) {
          // Bootstrap a minimal profile so the page still renders something
          setProfile({
            id: user.id,
            username: user.email?.split('@')[0] ?? '',
            email: user.email ?? '',
            role: 'member',
            status: 'active',
            avatar_url: null,
            company_name: null,
            inc_rate: 0,
            last_updated_at: null,
            created_at: new Date().toISOString(),
          } as Profile)
        } else {
          setProfile(data)
        }
      } catch (err) {
        setLoadError((err as Error).message)
      } finally {
        setLoadingProfile(false)
      }
    }
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        username: profile.username ?? '',
        company_name: profile.company_name ?? null,
      })
      .eq('id', profile.id)

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile.' })
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully.' })
    }
    setSaving(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    const fileExt = file.name.split('.').pop() ?? 'png'
    const filePath = `${profile.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setMessage({ type: 'error', text: uploadError.message || 'Failed to upload avatar.' })
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)

    const { error: updateErr } = await supabase
      .from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
    if (updateErr) {
      setMessage({ type: 'error', text: updateErr.message })
      return
    }
    setProfile({ ...profile, avatar_url: publicUrl })
    setMessage({ type: 'success', text: 'Avatar updated.' })
  }

  // Null-safe initial for the avatar fallback (Bug fix: username could be null/empty)
  const avatarInitial = (profile?.username?.trim() || profile?.email?.trim() || '?')
    .charAt(0).toUpperCase()

  if (loadingProfile) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <Card><CardContent className="py-8 text-center text-sm text-gray-500">Loading your profile…</CardContent></Card>
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <Card><CardContent className="py-8 text-sm text-red-700">
          {loadError || 'Unable to load profile. Please sign out and back in.'}
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <div className={`mb-4 px-4 py-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-6 mb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-menke-navy text-white text-2xl">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar" className="cursor-pointer text-blue-600 hover:underline text-sm">
                Change avatar
              </Label>
              <input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <p className="text-xs text-gray-400 mt-1">JPG, PNG. Max 1MB.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={profile.username ?? ''}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email ?? ''} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-400">Email cannot be changed.</p>
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={profile.company_name ?? ''}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile.role ?? 'member'} disabled className="bg-gray-50 capitalize" />
            </div>
            <Button type="submit" className="bg-menke-navy hover:bg-menke-navy-light" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
