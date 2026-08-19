'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ShieldCheck, FlaskConical, Eye, User as UserIcon } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string
  researcher_color: string | null
  avatar_url: string | null
  created_at: string
}

const ROLE_META: Record<string, { label: string; color: string; Icon: typeof UserIcon }> = {
  admin:      { label: 'Admins',      color: '#7A1010', Icon: ShieldCheck  },
  researcher: { label: 'Researchers', color: '#CE2029', Icon: FlaskConical },
  supervisor: { label: 'Supervisors', color: '#C6A8F0', Icon: Eye         },
  participant:{ label: 'Participants',color: '#86C99A', Icon: UserIcon    },
}
const ROLE_ORDER = ['admin', 'researcher', 'supervisor', 'participant']

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, researcher_color, avatar_url, created_at')
        .order('created_at', { ascending: false })

      setProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? profiles.filter(p =>
          p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      : profiles

    const byRole: Record<string, Profile[]> = {}
    for (const p of filtered) (byRole[p.role] ??= []).push(p)
    return byRole
  }, [profiles, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of profiles) c[p.role] = (c[p.role] ?? 0) + 1
    return c
  }, [profiles])

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading users…</div>
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profiles.length ? `${profiles.length} ${profiles.length === 1 ? 'person' : 'people'} on the platform` : 'No users yet.'}
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ROLE_ORDER.map(role => {
          const meta = ROLE_META[role]
          return (
            <div key={role} className="rounded-md border border-border px-4 py-3 bg-card">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.11em] uppercase text-muted-foreground">
                  {meta.label}
                </span>
                <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>
              <p className="font-mono text-2xl font-medium tabular-nums leading-none mt-2 text-foreground">
                {counts[role] ?? 0}
              </p>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Grouped roster */}
      <div className="space-y-6">
        {ROLE_ORDER.filter(role => grouped[role]?.length).map(role => {
          const meta = ROLE_META[role]
          return (
            <div key={role}>
              <p className="section-label mb-2 flex items-center gap-1.5">
                <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                {meta.label}
                <span className="text-muted-foreground font-normal normal-case">({grouped[role].length})</span>
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {grouped[role].map((profile, i) => (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i < grouped[role].length - 1 ? 'border-b border-border' : ''}`}
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: profile.researcher_color || meta.color }}
                      >
                        {getInitials(profile.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{profile.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono shrink-0">
                      {new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {profiles.length > 0 && Object.keys(grouped).length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-12">No users match &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  )
}
