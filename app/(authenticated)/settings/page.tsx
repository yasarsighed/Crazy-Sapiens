'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/color-picker'
import { toast } from 'sonner'
import { Camera, Lock, User, Palette, ShieldAlert, Mail, FileDown } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ResearcherColor } from '@/types/database'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type TabKey = 'profile' | 'security' | 'preferences' | 'data'

const TABS: Array<{ key: TabKey; label: string; icon: typeof User }> = [
  { key: 'profile',     label: 'Profile',     icon: User },
  { key: 'security',    label: 'Security',    icon: Lock },
  { key: 'preferences', label: 'Preferences', icon: Palette },
  { key: 'data',        label: 'Data',        icon: FileDown },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [researcherColor, setResearcherColor] = useState<ResearcherColor>('#2D6A4F')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      setCreatedAt(user.created_at ?? null)

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
    if (role === 'researcher' || role === 'admin') updates.researcher_color = researcherColor
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) toast.error('Failed to save', { description: error.message })
    else toast.success('Profile updated')
    setSaving(false)
  }

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading settings…</div>
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and account.</p>
      </div>

      <div className="flex gap-6 flex-col md:flex-row">
        {/* Tab rail */}
        <nav className="md:w-44 shrink-0 flex md:flex-col gap-1 border-b md:border-b-0 md:border-r border-border md:pr-4 pb-2 md:pb-0">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" /> {t.label}
              </button>
            )
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 space-y-6 min-w-0">
          {tab === 'profile' && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Profile picture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
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

              <Card>
                <CardHeader className="pb-3"><CardTitle className="font-serif text-base">Profile details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={email} disabled />
                    <p className="text-[10px] text-muted-foreground">Email changes aren&apos;t supported yet — contact support.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={role} disabled className="capitalize" />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'security' && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    To change your password, we&apos;ll send a reset link to your email.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href="/forgot-password">Send password reset email</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{email}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="capitalize">{role}</span></div>
                  {createdAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Member since</span>
                      <span>{new Date(createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'preferences' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(role === 'researcher' || role === 'admin') ? (
                  <div className="space-y-2">
                    <Label>Your colour</Label>
                    <p className="text-xs text-muted-foreground">Used across your studies, dashboard accents, and participant views.</p>
                    <ColorPicker value={researcherColor} onChange={setResearcherColor} />
                    <Button onClick={handleSave} disabled={saving} className="mt-2">
                      {saving ? 'Saving…' : 'Save colour'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No preferences available for your role yet.</p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'data' && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <FileDown className="w-4 h-4" /> Export your data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Download a copy of the data tied to your account. For study-level exports, open the study page.
                  </p>
                  <Button variant="outline" disabled>Coming soon</Button>
                </CardContent>
              </Card>
              <Card className="border-destructive/40">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-destructive flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Danger zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Deleting your account removes your profile and revokes access. Study data created by you is retained for research integrity — contact an admin to wipe it.
                  </p>
                  <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" disabled>
                    Delete account (coming soon)
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
