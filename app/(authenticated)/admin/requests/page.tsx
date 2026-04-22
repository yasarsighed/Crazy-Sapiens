'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, CheckCircle, XCircle, Clock, Filter } from 'lucide-react'

interface PlatformRequest {
  id: string
  request_type: 'cohort_access' | 'cohort_creation' | 'study_approval'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  review_notes: string | null
  payload: Record<string, unknown>
  entity_id: string | null
  requester: { full_name: string | null; email: string | null; researcher_color: string | null }
  reviewer?: { full_name: string | null } | null
  entity_cohort?: { name: string } | null
  entity_study?: { title: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  cohort_creation: 'New cohort',
  cohort_access:   'Cohort access',
  study_approval:  'Study approval',
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function RequestCard({
  req,
  onReviewed,
}: {
  req: PlatformRequest
  onReviewed: () => void
}) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [expanded, setExpanded] = useState(req.status === 'pending')

  const review = async (action: 'approve' | 'reject') => {
    setSubmitting(action)
    try {
      const res = await fetch(`/api/requests/${req.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return }
      toast.success(action === 'approve' ? 'Request approved' : 'Request rejected')
      onReviewed()
    } finally {
      setSubmitting(null)
    }
  }

  const requester = req.requester as any
  const reviewer = req.reviewer as any

  const contextLine = (() => {
    if (req.request_type === 'cohort_creation') {
      const p = req.payload as { name?: string; description?: string }
      return `Cohort name: "${p.name}"${p.description ? ` — ${p.description}` : ''}`
    }
    if (req.request_type === 'cohort_access') {
      const p = req.payload as { access_level?: string }
      const cohort = req.entity_cohort as any
      return `Cohort: "${cohort?.name ?? req.entity_id}" — requesting ${p.access_level ?? 'view'} access`
    }
    if (req.request_type === 'study_approval') {
      const study = req.entity_study as any
      return `Study: "${study?.title ?? req.entity_id}"`
    }
    return null
  })()

  return (
    <Card className={req.status !== 'pending' ? 'opacity-70' : ''}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
              style={{ backgroundColor: requester?.researcher_color ?? '#2D6A4F' }}
            >
              {getInitials(requester?.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{requester?.full_name ?? requester?.email}</p>
              <p className="text-[10px] text-muted-foreground">{requester?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[req.request_type]}</Badge>
            <Badge
              variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}
              className="text-[10px]"
            >
              {req.status === 'pending' && <Clock className="w-2.5 h-2.5 mr-1 inline" />}
              {req.status === 'approved' && <CheckCircle className="w-2.5 h-2.5 mr-1 inline" />}
              {req.status === 'rejected' && <XCircle className="w-2.5 h-2.5 mr-1 inline" />}
              {req.status}
            </Badge>
          </div>
        </div>

        {contextLine && (
          <p className="text-xs text-muted-foreground pl-10">{contextLine}</p>
        )}

        <p className="text-[10px] text-muted-foreground pl-10">
          Submitted {new Date(req.created_at).toLocaleString()}
          {req.reviewed_at && reviewer && (
            <> · Reviewed by {reviewer?.full_name ?? 'admin'} on {new Date(req.reviewed_at).toLocaleString()}</>
          )}
        </p>

        {req.review_notes && (
          <p className="text-xs text-muted-foreground italic pl-10 border-l-2 border-border ml-10">
            {req.review_notes}
          </p>
        )}

        {req.status === 'pending' && (
          <div className="pl-10 space-y-2">
            <Textarea
              placeholder="Optional review notes (visible to requester)…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => review('approve')}
                disabled={submitting !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                {submitting === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => review('reject')}
                disabled={submitting !== null}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PlatformRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [isAdmin, setIsAdmin] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (p?.role !== 'admin') { router.push('/dashboard'); return }
    setIsAdmin(true)

    let q = supabase
      .from('platform_requests')
      .select(`
        id, request_type, status, created_at, reviewed_at, review_notes, payload, entity_id,
        requester:profiles!platform_requests_requester_id_fkey(full_name, email, researcher_color),
        reviewer:profiles!platform_requests_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })

    if (filter === 'pending') q = q.eq('status', 'pending')

    const { data: rows } = await q
    const enriched = await Promise.all((rows ?? []).map(async (r: any) => {
      let entity_cohort = null
      let entity_study = null
      if (r.entity_id) {
        if (r.request_type === 'cohort_access') {
          const { data } = await supabase.from('cohorts').select('name').eq('id', r.entity_id).single()
          entity_cohort = data
        }
        if (r.request_type === 'study_approval') {
          const { data } = await supabase.from('studies').select('title').eq('id', r.entity_id).single()
          entity_study = data
        }
      }
      return { ...r, entity_cohort, entity_study }
    }))

    setRequests(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (loading) return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Loading requests…</div>

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" /> Platform Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review cohort creation, access, and study approval requests from researchers.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
          >
            Pending {pendingCount > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{pendingCount}</Badge>}
          </Button>
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-serif text-base text-foreground mb-1">
            {filter === 'pending' ? 'No pending requests' : 'No requests yet'}
          </p>
          <p className="text-xs text-muted-foreground">
            {filter === 'pending' ? 'All caught up!' : 'Requests from researchers will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <RequestCard key={r.id} req={r} onReviewed={load} />
          ))}
        </div>
      )}
    </div>
  )
}
