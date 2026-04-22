import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'

// POST /api/participants/bulk-create
// Body: { rows: Array<{ email, full_name }>, study_id? }
// Creates many participants in one go. Skips duplicates gracefully.
// Returns per-row results so the UI can show a summary.
type BulkRow = { email: string; full_name: string }
type RowResult = {
  email: string
  ok: boolean
  participant_id?: string
  temp_password?: string
  error?: string
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

    const svc = createServiceClient()
    const results: RowResult[] = []

    for (const raw of rows) {
      const email = (raw.email ?? '').trim().toLowerCase()
      const full_name = (raw.full_name ?? '').trim()
      if (!email || !full_name) {
        results.push({ email, ok: false, error: 'missing email or full_name' })
        continue
      }

      const tempPassword = `Tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
      const { data: created, error: createErr } = await svc.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role: 'participant' },
      })

      if (createErr || !created?.user) {
        results.push({ email, ok: false, error: createErr?.message || 'Failed to create user' })
        continue
      }

      const newUserId = created.user.id

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
      }

      results.push({ email, ok: true, participant_id: newUserId, temp_password: tempPassword })
    }

    const createdCount = results.filter(r => r.ok).length
    await logActivity(user.id, 'participants_bulk_added', 'study', study_id ?? null, {
      total: rows.length,
      created: createdCount,
      failed: rows.length - createdCount,
    })

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
