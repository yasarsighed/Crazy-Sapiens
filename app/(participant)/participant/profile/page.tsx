'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Camera, KeyRound, Save, User } from 'lucide-react'
import Link from 'next/link'

const GENDER_OPTIONS = ['Prefer not to say', 'Male', 'Female', 'Non-binary', 'Genderqueer', 'Agender', 'Other']
const EDUCATION_OPTIONS = [
  'Prefer not to say',
  'No formal education',
  'Primary school',
  'Secondary school / GCSEs',
  'A-levels / High school diploma',
  'Some college / undergraduate (no degree)',
  'Bachelor\'s degree',
  'Postgraduate certificate / diploma',
  'Master\'s degree',
  'Doctoral degree (PhD/MD/etc.)',
  'Vocational / trade qualification',
]

interface Profile {
  full_name: string | null
  email: string | null
  avatar_url: string | null
  date_of_birth: string | null
  gender: string | null
  education_level: string | null
  occupation: string | null
}

export default function ParticipantProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [occupation, setOccupation] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url, date_of_birth, gender, education_level, occupation')
        .eq('id', user.id)
        .single()
      if (data) {
        setProfile(data)
        setFullName(data.full_name ?? '')
        setDateOfBirth(data.date_of_birth ?? '')
        setGender(data.gender ?? '')
        setEducationLevel(data.education_level ?? '')
        setOccupation(data.occupation ?? '')
        setAvatarUrl(data.avatar_url)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return }
    setUploadingAvatar(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { toast.error('Upload failed', { description: upErr.message }); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    setAvatarUrl(url)
    toast.success('Profile picture updated')
    setUploadingAvatar(false)
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      education_level: educationLevel || null,
      occupation: occupation.trim() || null,
    }).eq('id', userId)
    if (error) {
      toast.error('Failed to save', { description: error.message })
    } else {
      toast.success('Profile saved')
    }
    setSaving(false)
  }

  function getInitials(name: string | null) {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) return <div className="max-w-lg mx-auto px-6 py-10 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <Link
        href="/participant/dashboard"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <h1 className="font-serif text-2xl text-foreground mb-6 flex items-center gap-2">
        <User className="w-5 h-5" /> My profile
      </h1>

      {/* Avatar section */}
      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-sm">Profile picture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-serif font-semibold">
                  {getInitials(fullName || profile?.email)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                {uploadingAvatar ? 'Uploading…' : 'Change picture'}
              </Button>
              <p className="text-[11px] text-muted-foreground">JPG, PNG or WebP · max 2 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-sm">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Gender</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select…</option>
              {GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Highest education level</label>
            <select
              value={educationLevel}
              onChange={e => setEducationLevel(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select…</option>
              {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Occupation / field of work</label>
            <input
              type="text"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              placeholder="e.g. Student, Software engineer, Nurse…"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full mb-4">
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Saving…' : 'Save changes'}
      </Button>

      {/* Password */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reset via email link</p>
            </div>
            <Link href="/forgot-password">
              <Button size="sm" variant="outline">
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Change password
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
