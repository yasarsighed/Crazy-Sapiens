import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'

// POST /api/participants/create
// Body: { email, full_name, study_id?, password? }
// Admin or researcher creates a participant profile (and optional enrollment).
// A random password is generated if not provided. Participant can reset via email.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actor } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!actor || !['admin', 'researcher'].includes(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, full_name, study_id, password } = await req.json()
    if (!email || !full_name) {
      return NextResponse.json({ error: 'email and full_name required' }, { status: 400 })
    }

    const svc = createServiceClient()
    const tempPassword =
      password ||
      `Tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`

    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role: 'participant' },
    })
    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message || 'Failed to create user' },
        { status: 400 },
      )
    }

    const newUserId = created.user.id

    // Trigger should have created the profile, but upsert to be safe
    await svc.from('profiles').upsert({
      id: newUserId,
      email,
      full_name,
      role: 'participant',
    }, { onConflict: 'id' })

    if (study_id) {
      await svc.from('study_enrollments').insert({
        study_id,
        participant_id: newUserId,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      })
      await logActivity(user.id, 'enrollment', 'participant', newUserId, { study_id, manual: true })
    }

    await logActivity(user.id, 'participant_added', 'participant', newUserId, { email, study_id })

    return NextResponse.json({
      ok: true,
      participant_id: newUserId,
      temp_password: password ? undefined : tempPassword,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
