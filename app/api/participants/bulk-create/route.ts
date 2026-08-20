import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'

// POST /api/participants/bulk-create
// Body: { rows: Array<{ email, full_name }>, study_id? }
// Creates many participants in one go. Skips duplicates gracefully.
// Returns per-row results so the UI can show a summary.
//
// Processes rows in small concurrent batches rather than one at a time —
// 200 fully sequential auth.admin.createUser() calls (each a real network
// round trip) risked running past Vercel's function timeout before this
// route ever finished. Batching is also just faster. maxDuration is a
// second line of defense, not the primary fix.
export const maxDuration = 300

const BATCH_SIZE = 10

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

    async function createOneParticipant(raw: BulkRow): Promise<RowResult> {
      const email = (raw.email ?? '').trim().toLowerCase()
      const full_name = (raw.full_name ?? '').trim()
      if (!email || !full_name) {
        return { email, ok: false, error: 'missing email or full_name' }
      }

      const tempPassword = `Tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
      const { data: created, error: createErr } = await svc.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role: 'participant' },
      })

      if (createErr || !created?.user) {
        return { email, ok: false, error: createErr?.message || 'Failed to create user' }
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

      return { email, ok: true, participant_id: newUserId, temp_password: tempPassword }
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map(createOneParticipant))
      results.push(...batchResults)
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
