import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// POST /api/cohorts/[cid]/access
// Researchers submit a cohort_access request; admins grant directly.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> },
) {
  const { cid } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { access_level?: 'view' | 'contribute'; researcher_id?: string }
  const accessLevel = body.access_level ?? 'view'

  const svc = createServiceClient()

  // Verify cohort exists
  const { data: cohort } = await svc.from('cohorts').select('id').eq('id', cid).single()
  if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })

  // Admins grant access directly
  if (profile.role === 'admin') {
    const targetId = body.researcher_id ?? user.id
    const { error } = await svc.from('cohort_researcher_access').upsert({
      cohort_id:     cid,
      researcher_id: targetId,
      access_level:  accessLevel,
      granted_by:    user.id,
    }, { onConflict: 'cohort_id,researcher_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Researchers and supervisors submit a request
  if (!['researcher', 'supervisor'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await svc.from('platform_requests').insert({
    requester_id: user.id,
    request_type: 'cohort_access',
    entity_type:  'cohort',
    entity_id:    cid,
    payload:      { access_level: accessLevel },
    status:       'pending',
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requestId: data.id, pending: true })
}
