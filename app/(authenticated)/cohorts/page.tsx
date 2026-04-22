'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import Link from 'next/link'
import { Users, Plus, Lock, ChevronRight, Database, Clock } from 'lucide-react'

interface Cohort {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
  member_count?: number
  study_count?: number
  my_access?: string | null
}

interface Profile {
  id: string
  role: string
}

export default function CohortsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
    setProfile(p)

    const { data: rows } = await supabase
      .from('cohorts')
      .select('id, name, description, status, created_at')
      .order('created_at', { ascending: false })

    if (!rows) { setLoading(false); return }

    // Enrich with member + study counts
    const enriched = await Promise.all(rows.map(async c => {
      const [{ count: memberCount }, { count: studyCount }] = await Promise.all([
        supabase.from('cohort_members').select('*', { count: 'exact', head: true }).eq('cohort_id', c.id).eq('status', 'active'),
        supabase.from('studies').select('*', { count: 'exact', head: true }).eq('cohort_id', c.id),
      ])

      // Check researcher's own access level
      let myAccess: string | null = null
      if (p?.role !== 'admin') {
        const { data: access } = await supabase
          .from('cohort_researcher_access')
          .select('access_level')
          .eq('cohort_id', c.id)
          .eq('researcher_id', user.id)
          .single()
        myAccess = access?.access_level ?? null
      }

      return { ...c, member_count: memberCount ?? 0, study_count: studyCount ?? 0, my_access: myAccess }
    }))

    setCohorts(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/cohorts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to create cohort'); return }
      if (json.pending) {
        toast.success('Request submitted — awaiting admin approval')
      } else {
        toast.success('Cohort created')
      }
      setShowCreate(false)
      setName('')
      setDescription('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = profile?.role === 'admin'

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading cohorts…</div>

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" /> Cohorts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Named participant pools with a shared baseline battery.
            {!isAdmin && ' Researchers must request access or creation — an admin will review.'}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {isAdmin ? 'New cohort' : 'Request cohort'}
        </Button>
      </div>

      {/* Create / request form */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="pt-5 space-y-4">
            <h2 className="font-serif text-base">
              {isAdmin ? 'Create new cohort' : 'Request new cohort'}
            </h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. First-year psychology students 2026"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional context about inclusion criteria, recruitment channel, etc."
                rows={3}
              />
            </div>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                This will be submitted for admin approval before the cohort is created.
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? 'Submitting…' : isAdmin ? 'Create' : 'Submit request'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cohort list */}
      {cohorts.length === 0 ? (
        <div className="text-center py-20">
          <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-serif text-base text-foreground mb-1">No cohorts yet</p>
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? 'Create the first cohort using the button above.'
              : 'Request a new cohort or ask an admin for access to an existing one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cohorts.map(c => (
            <Link key={c.id} href={`/cohorts/${c.id}`} className="block group">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                    >
                      {c.status}
                    </Badge>
                    {!isAdmin && c.my_access && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{c.my_access}</Badge>
                    )}
                    {!isAdmin && !c.my_access && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Lock className="w-3 h-3" /> no access
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {c.member_count}
                  </span>
                  <span>{c.study_count} {c.study_count === 1 ? 'study' : 'studies'}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
