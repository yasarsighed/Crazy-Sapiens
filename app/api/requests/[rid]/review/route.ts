import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Admin-only: approve or reject a platform request.
// On approval of cohort_creation, creates the cohort automatically.
// On approval of cohort_access, grants researcher access.
// On approval of study_approval, sets study status to 'active'.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ rid: string }> },
) {
  const { rid } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { action: 'approve' | 'reject'; notes?: string }
  if (!['approve', 'reject'].includes(body.action))
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })

  const svc = createServiceClient()

  // Fetch the request
  const { data: request, error: fetchErr } = await svc
    .from('platform_requests')
    .select('*')
    .eq('id', rid)
    .single()
  if (fetchErr || !request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

  // Update status
  await svc.from('platform_requests').update({
    status:       body.action === 'approve' ? 'approved' : 'rejected',
    reviewed_by:  user.id,
    reviewed_at:  new Date().toISOString(),
    review_notes: body.notes?.trim() ?? null,
  }).eq('id', rid)

  if (body.action === 'reject') return NextResponse.json({ ok: true })

  // Side-effects on approval
  if (request.request_type === 'cohort_creation') {
    const p = request.payload as { name: string; description: string }
    await svc.from('cohorts').insert({
      name:        p.name,
      description: p.description ?? null,
      status:      'active',
      created_by:  request.requester_id,
    })
  }

  if (request.request_type === 'cohort_access' && request.entity_id) {
    const p = request.payload as { access_level?: string }
    await svc.from('cohort_researcher_access').upsert({
      cohort_id:     request.entity_id,
      researcher_id: request.requester_id,
      access_level:  p.access_level ?? 'view',
      granted_by:    user.id,
    }, { onConflict: 'cohort_id,researcher_id' })
  }

  if (request.request_type === 'study_approval' && request.entity_id) {
    await svc.from('studies').update({ status: 'active' }).eq('id', request.entity_id)
  }

  return NextResponse.json({ ok: true })
}
