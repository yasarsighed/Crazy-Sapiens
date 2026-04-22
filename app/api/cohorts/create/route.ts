import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const body = await req.json() as { name: string; description?: string; status?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // Admins create directly; researchers must submit a request
  if (profile?.role === 'admin') {
    const svc = createServiceClient()
    const { data, error } = await svc.from('cohorts').insert({
      name:        body.name.trim(),
      description: body.description?.trim() ?? null,
      status:      body.status ?? 'active',
      created_by:  user.id,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ cohortId: data.id })
  }

  if (!['researcher', 'supervisor'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Researcher → create a cohort_creation request
  const svc = createServiceClient()
  const { data, error } = await svc.from('platform_requests').insert({
    requester_id: user.id,
    request_type: 'cohort_creation',
    entity_type:  'cohort',
    payload: { name: body.name.trim(), description: body.description?.trim() ?? '' },
    status: 'pending',
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requestId: data.id, pending: true })
}
