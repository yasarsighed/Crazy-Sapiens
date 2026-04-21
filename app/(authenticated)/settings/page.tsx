'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/color-picker'
import { toast } from 'sonner'
import { Camera, Lock, User } from 'lucide-react'
import Link from 'next/link'
import type { ResearcherColor } from '@/types/database'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [researcherColor, setResearcherColor] = useState<ResearcherColor>('#2D6A4F')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, researcher_color, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name ?? '')
        setRole(profile.role ?? '')
        setResearcherColor((profile.researcher_color as ResearcherColor) ?? '#2D6A4F')
        setAvatarUrl(profile.avatar_url ?? null)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large', { description: 'Please choose an image under 2 MB.' })
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) {
      toast.error('Upload failed', { description: uploadErr.message })
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    await supabase.from('profiles').update({ avatar_url: urlWithBust }).eq('id', userId)
    setAvatarUrl(urlWithBust)
    toast.success('Profile picture updated')
    setUploading(false)
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()

    const updates: Record<string, string> = { full_name: fullName.trim() }
    if (role === 'researcher' || role === 'admin') {
      updates.researcher_color = researcherColor
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) {
      toast.error('Failed to save', { description: error.message })
    } else {
      toast.success('Profile updated')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading settings…</div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and account preferences.</p>
      </div>

      {/* Profile picture */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <User className="w-4 h-4" /> Profile picture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-medium"
                  style={{ backgroundColor: researcherColor }}
                >
                  {getInitials(fullName)}
                </div>
              )}
              <button
                onClick={handleAvatarClick}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={handleAvatarClick} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Change photo'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP · max 2 MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </CardContent>
      </Card>

      {/* Profile details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Profile details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {(role === 'researcher' || role === 'admin') && (
            <div className="space-y-2">
              <Label>Your colour</Label>
              <p className="text-xs text-muted-foreground">Used across your studies and dashboard</p>
              <ColorPicker value={researcherColor} onChange={setResearcherColor} />
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Lock className="w-4 h-4" /> Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            To change your password, we'll send a reset link to your email address.
          </p>
          <Button variant="outline" asChild>
            <Link href="/forgot-password">Send password reset email</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
