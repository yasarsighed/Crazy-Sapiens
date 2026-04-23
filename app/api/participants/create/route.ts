import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'
import { getAppOrigin } from '@/lib/app-origin'

// POST /api/participants/create
// Body: { email, full_name, study_id? }
// Sends an invitation email to the participant via Supabase Auth.
// They click the link, land on /participant/dashboard, and can set a password later.
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

    const { email, full_name, study_id } = await req.json()
    if (!email || !full_name) {
      return NextResponse.json({ error: 'email and full_name required' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role: 'participant' },
      redirectTo: `${getAppOrigin()}/auth/callback?next=/participant/dashboard`,
    })

    if (inviteErr || !invited?.user) {
      // "Database error" usually means the on_auth_user_created trigger is failing
      // — run supabase/fix-profile-trigger.sql in the Supabase dashboard.
      const hint = inviteErr?.message?.toLowerCase().includes('database error')
        ? ' (trigger failure — run supabase/fix-profile-trigger.sql in Supabase dashboard)'
        : ''
      return NextResponse.json(
        { error: (inviteErr?.message || 'Failed to invite user') + hint },
        { status: 400 },
      )
    }

    const newUserId = invited.user.id

    // Trigger creates the profile; upsert here catches the case where it didn't run
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

    return NextResponse.json({ ok: true, participant_id: newUserId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
