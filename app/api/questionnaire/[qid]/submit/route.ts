import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'

export async function POST(
  req: NextRequest,
  { params }: { params: { qid: string } },
) {
  const { qid } = params

  // Verify the caller is an authenticated participant
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { responseRecords, scoredPayload, alertPayload } = body

  // Validate that participant_id in payload matches the authenticated user
  if (scoredPayload?.participant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // ── Save item responses ───────────────────────────────────────────────────
  if (responseRecords?.length) {
    const { error: respErr } = await svc
      .from('questionnaire_item_responses')
      .upsert(responseRecords, {
        onConflict: 'questionnaire_id,participant_id,item_id',
        ignoreDuplicates: false,
      })
    if (respErr) {
      // Try plain insert if unique constraint missing
      if (respErr.code === '42P10' || respErr.message?.includes('unique constraint')) {
        const { error: insErr } = await svc.from('questionnaire_item_responses').insert(responseRecords)
        if (insErr) return NextResponse.json({ error: `Could not save responses: ${insErr.message}` }, { status: 500 })
      } else {
        return NextResponse.json({ error: `Could not save responses: ${respErr.message}` }, { status: 500 })
      }
    }
  }

  // ── Save scored result ────────────────────────────────────────────────────
  const { data: scoredResult, error: scoreErr } = await svc
    .from('questionnaire_scored_results')
    .upsert(scoredPayload, { onConflict: 'questionnaire_id,participant_id' })
    .select('id')
    .single()

  if (scoreErr) {
    if (scoreErr.code === '42P10' || scoreErr.message?.includes('unique constraint')) {
      const { data: ins, error: insErr } = await svc
        .from('questionnaire_scored_results')
        .insert(scoredPayload)
        .select('id')
        .single()
      if (insErr) return NextResponse.json({ error: `Could not save score: ${insErr.message}` }, { status: 500 })
      if (alertPayload && ins) {
        await Promise.resolve(svc.from('clinical_alerts_log').insert({ ...alertPayload, scored_result_id: ins.id })).catch(() => {})
      }
      return NextResponse.json({ ok: true, scoredResultId: ins?.id })
    }
    return NextResponse.json({ error: `Could not save score: ${scoreErr.message}` }, { status: 500 })
  }

  // ── Fire clinical alert (non-fatal) ──────────────────────────────────────
  if (alertPayload && scoredResult) {
    await Promise.resolve(
      svc.from('clinical_alerts_log').insert({ ...alertPayload, scored_result_id: scoredResult.id })
    ).catch(() => {})
  }

  // Log completion
  await logActivity(user.id, 'completion', 'questionnaire', qid, {
    questionnaire_id: qid,
    score: scoredPayload?.total_score,
    alert_fired: !!alertPayload,
  })

  return NextResponse.json({ ok: true, scoredResultId: scoredResult?.id })
}
