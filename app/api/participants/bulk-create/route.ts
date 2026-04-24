import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'
import { getAppOrigin } from '@/lib/app-origin'

// POST /api/participants/bulk-create
// Body: { rows: Array<{ email, full_name }>, study_id? }
// Invites many participants at once. Each gets an invitation email from Supabase.
// Returns per-row results so the UI can show a summary.
type BulkRow = { email: string; full_name: string }
type RowResult = {
  email: string
  ok: boolean
  participant_id?: string
  error?: string
}

async function inviteOne(
  raw: BulkRow,
  svc: ReturnType<typeof createServiceClient>,
  study_id: string | undefined,
  redirectTo: string,
): Promise<RowResult> {
  const email     = (raw.email     ?? '').trim().toLowerCase()
  const full_name = (raw.full_name ?? '').trim()
  if (!email || !full_name) {
    return { email, ok: false, error: 'missing email or full_name' }
  }

  const { data: invited, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role: 'participant' },
    redirectTo,
  })

  if (inviteErr || !invited?.user) {
    return { email, ok: false, error: inviteErr?.message || 'Failed to invite user' }
  }

  const newUserId = invited.user.id

  await svc.from('profiles').upsert(
    { id: newUserId, email, full_name, role: 'participant' },
    { onConflict: 'id' },
  )

  if (study_id) {
    await svc.from('study_enrollments').insert({
      study_id,
      participant_id: newUserId,
      status:         'active',
      enrolled_at:    new Date().toISOString(),
    })
  }

  return { email, ok: true, participant_id: newUserId }
}

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

    const { rows, study_id } = (await req.json()) as { rows: BulkRow[]; study_id?: string }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows required' }, { status: 400 })
    }
    if (rows.length > 200) {
      return NextResponse.json({ error: 'Max 200 rows per request' }, { status: 400 })
    }

    const svc        = createServiceClient()
    const redirectTo = `${getAppOrigin()}/auth/callback?next=/participant/dashboard`

    // Process in parallel chunks of 10 to avoid rate-limiting the Supabase Admin API
    const CHUNK   = 10
    const results: RowResult[] = []
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk        = rows.slice(i, i + CHUNK)
      const chunkResults = await Promise.all(
        chunk.map(raw => inviteOne(raw, svc, study_id, redirectTo)),
      )
      results.push(...chunkResults)
    }

    const createdCount = results.filter(r => r.ok).length
    await logActivity(user.id, 'participants_bulk_added', 'study', study_id ?? null, {
      total:   rows.length,
      created: createdCount,
      failed:  rows.length - createdCount,
    })

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
