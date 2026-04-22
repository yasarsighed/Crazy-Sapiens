'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, Users, FlaskConical, UserCheck, Lock, Clock,
  Plus, X, ChevronDown,
} from 'lucide-react'

interface CohortDetail {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
  created_by: string | null
}

interface Member {
  participant_id: string
  enrolled_at: string
  status: string
  profile: { full_name: string | null; email: string | null }
}

interface ResearchAccess {
  researcher_id: string
  access_level: string
  granted_at: string
  profile: { full_name: string | null; email: string | null; researcher_color: string | null }
}

interface Study {
  id: string
  title: string
  status: string
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function CohortDetailPage() {
  const params = useParams()
  const router = useRouter()
  const cid = params.cid as string

  const [myRole, setMyRole] = useState<string>('')
  const [myId, setMyId] = useState<string>('')
  const [myAccess, setMyAccess] = useState<string | null>(null)
  const [cohort, setCohort] = useState<CohortDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [researchTeam, setResearchTeam] = useState<ResearchAccess[]>([])
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [requestingAccess, setRequestingAccess] = useState(false)
  const [accessLevel, setAccessLevel] = useState<'view' | 'contribute'>('view')

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: p } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
    setMyRole(p?.role ?? '')
    setMyId(user.id)

    const { data: c, error } = await supabase
      .from('cohorts')
      .select('id, name, description, status, created_at, created_by')
      .eq('id', cid)
      .single()

    if (error || !c) { toast.error('Cohort not found'); router.push('/cohorts'); return }
    setCohort(c)

    // Own access (for non-admins)
    if (p?.role !== 'admin') {
      const { data: acc } = await supabase
        .from('cohort_researcher_access')
        .select('access_level')
        .eq('cohort_id', cid)
        .eq('researcher_id', user.id)
        .single()
      setMyAccess(acc?.access_level ?? null)
    } else {
      setMyAccess('admin')
    }

    const [membersRes, teamRes, studiesRes] = await Promise.all([
      supabase
        .from('cohort_members')
        .select('participant_id, enrolled_at, status, profile:profiles(full_name, email)')
        .eq('cohort_id', cid)
        .order('enrolled_at', { ascending: false }),
      supabase
        .from('cohort_researcher_access')
        .select('researcher_id, access_level, granted_at, profile:profiles(full_name, email, researcher_color)')
        .eq('cohort_id', cid),
      supabase
        .from('studies')
        .select('id, title, status')
        .eq('cohort_id', cid)
        .order('created_at', { ascending: false }),
    ])

    setMembers((membersRes.data as any[]) ?? [])
    setResearchTeam((teamRes.data as any[]) ?? [])
    setStudies(studiesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [cid])

  const requestAccess = async () => {
    setRequestingAccess(true)
    try {
      const res = await fetch(`/api/cohorts/${cid}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_level: accessLevel }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return }
      if (json.pending) {
        toast.success('Access request submitted — awaiting admin approval')
      } else {
        toast.success('Access granted')
        await load()
      }
    } finally {
      setRequestingAccess(false)
    }
  }

  const revokeAccess = async (researcherId: string) => {
    if (!window.confirm('Revoke this researcher\'s access?')) return
    const supabase = createClient()
    const { error } = await supabase
      .from('cohort_researcher_access')
      .delete()
      .eq('cohort_id', cid)
      .eq('researcher_id', researcherId)
    if (error) { toast.error('Failed to revoke access'); return }
    toast.success('Access revoked')
    await load()
  }

  const isAdmin = myRole === 'admin'
  const canView = isAdmin || myAccess !== null
  const hasAccess = myAccess !== null

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading cohort…</div>
  if (!cohort) return null

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/cohorts" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> All cohorts
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-foreground">{cohort.name}</h1>
            {cohort.description && (
              <p className="text-sm text-muted-foreground mt-1">{cohort.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">{cohort.status}</Badge>
              {!isAdmin && (
                myAccess
                  ? <Badge variant="secondary" className="text-[10px]">{myAccess} access</Badge>
                  : <Badge variant="outline" className="text-[10px] text-muted-foreground"><Lock className="w-2.5 h-2.5 mr-1 inline" />No access</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Access request — shown to non-admins without access */}
      {!isAdmin && !hasAccess && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Lock className="w-4 h-4" />
              <p className="text-sm font-medium">You don&apos;t have access to this cohort</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Submit a request and an admin will review it. You can see the cohort exists but cannot view member data until approved.
            </p>
            <div className="flex items-center gap-3">
              <select
                value={accessLevel}
                onChange={e => setAccessLevel(e.target.value as 'view' | 'contribute')}
                className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background"
              >
                <option value="view">View only</option>
                <option value="contribute">Contribute</option>
              </select>
              <Button size="sm" onClick={requestAccess} disabled={requestingAccess}>
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                {requestingAccess ? 'Submitting…' : 'Request access'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canView && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Members', value: members.length, icon: Users },
              { label: 'Studies', value: studies.length, icon: FlaskConical },
              { label: 'Research team', value: researchTeam.length, icon: UserCheck },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <s.icon className="w-5 h-5 text-muted-foreground/60" />
                  <div>
                    <p className="text-lg font-semibold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Studies */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">Linked studies</CardTitle>
            </CardHeader>
            <CardContent>
              {studies.length === 0 ? (
                <p className="text-xs text-muted-foreground">No studies linked to this cohort yet.</p>
              ) : (
                <div className="space-y-2">
                  {studies.map(s => (
                    <Link key={s.id} href={`/studies/${s.id}`} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:text-primary transition-colors">
                      <FlaskConical className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      <span className="text-sm flex-1 truncate">{s.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{s.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Research team */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">Research team</CardTitle>
            </CardHeader>
            <CardContent>
              {researchTeam.length === 0 ? (
                <p className="text-xs text-muted-foreground">No researchers have been granted access yet.</p>
              ) : (
                <div className="space-y-2">
                  {researchTeam.map(r => {
                    const p = r.profile as any
                    return (
                      <div key={r.researcher_id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                          style={{ backgroundColor: p?.researcher_color ?? '#2D6A4F' }}
                        >
                          {getInitials(p?.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p?.full_name ?? p?.email ?? 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground">{p?.email}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{r.access_level}</Badge>
                        {isAdmin && (
                          <button
                            onClick={() => revokeAccess(r.researcher_id)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
                            title="Revoke access"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">Members ({members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground">No participants enrolled in this cohort yet.</p>
              ) : (
                <div className="space-y-0">
                  {members.map(m => {
                    const p = m.profile as any
                    return (
                      <div key={m.participant_id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                          {getInitials(p?.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p?.full_name ?? 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground">{p?.email}</p>
                        </div>
                        <Badge
                          variant={m.status === 'active' ? 'default' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {m.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
