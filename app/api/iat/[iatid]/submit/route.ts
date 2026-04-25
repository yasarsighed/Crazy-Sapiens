import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'

// POST /api/iat/[iatid]/submit
//
// Saves IAT trial data + D-score using the service-role client so that RLS
// policies on iat_trial_log / iat_session_results can never block a
// participant's save.  All validation still runs against the authenticated
// session (user must be logged in and the participant_id must match).
//
// Idempotency: if a completed session row already exists for this
// participant + IAT we return 409 and do nothing.  This prevents double-
// submission while still allowing a clean retry if the first attempt
// partially failed (trial rows inserted but session row never landed).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iatid: string }> },
) {
  const { iatid } = await params

  // ── Auth ─────────────────────────────────────────────────────────────────
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json() as {
    sessionId:     string
    assignedOrder: 'A' | 'B'
    dScore:        number | null
    excluded:      boolean
    exclusionReason?: string
    trials: Array<{
      blockNumber:       number
      blockLabel:        string
      blockType:         string
      trialNumber:       number
      stimulusText:      string
      stimulusCategory:  string
      correctKey:        string
      pressedKey:        string
      responseTimeMs:    number
      isCorrect:         boolean
      isTooFast:         boolean
      excludedFromScoring: boolean
    }>
  }

  if (!body.sessionId || !body.trials?.length) {
    return NextResponse.json({ error: 'Missing sessionId or trials' }, { status: 400 })
  }

  const svc = createServiceClient()

  // ── Idempotency check ─────────────────────────────────────────────────────
  // Use session_results as the canonical "completed" marker.
  const { data: existing } = await svc
    .from('iat_session_results')
    .select('session_id')
    .eq('iat_id', iatid)
    .eq('participant_id', user.id)
    .maybeSingle()

  if (existing) {
    // Already have a valid session — safe to treat as success (participant sees results)
    return NextResponse.json({ ok: true, alreadySaved: true })
  }

  // ── Insert trial rows (batches of 100) ────────────────────────────────────
  // Purge any orphaned trial rows from a previous failed attempt first, so
  // we start clean and the unique-session guarantee holds.
  await svc
    .from('iat_trial_log')
    .delete()
    .eq('iat_id', iatid)
    .eq('participant_id', user.id)

  const trialRows = body.trials.map(t => ({
    iat_id:               iatid,
    participant_id:       user.id,
    session_id:           body.sessionId,
    block_number:         t.blockNumber,
    block_label:          t.blockLabel,
    block_type:           t.blockType,
    trial_number:         t.trialNumber,
    stimulus_text:        t.stimulusText,
    stimulus_category:    ({ conceptA: 'concept_a', conceptB: 'concept_b', attrA: 'attribute_a', attrB: 'attribute_b' } as Record<string, string>)[t.stimulusCategory] ?? t.stimulusCategory,
    correct_key:          t.correctKey,
    pressed_key:          t.pressedKey,
    response_time_ms:     t.responseTimeMs,
    is_correct:           t.isCorrect,
    is_too_fast:          t.isTooFast,
    excluded_from_scoring: t.excludedFromScoring,
  }))

  for (let i = 0; i < trialRows.length; i += 100) {
    const { error } = await svc.from('iat_trial_log').insert(trialRows.slice(i, i + 100))
    if (error) {
      return NextResponse.json(
        { error: `Failed to save trial data (batch ${Math.floor(i / 100) + 1}): ${error.message}` },
        { status: 500 },
      )
    }
  }

  // ── Insert session result ─────────────────────────────────────────────────
  const { error: sessionErr } = await svc.from('iat_session_results').insert({
    iat_id:           iatid,
    participant_id:   user.id,
    session_id:       body.sessionId,
    d_score:          body.dScore,
    computed_at:      new Date().toISOString(),
    assigned_order:   body.assignedOrder,
  })

  if (sessionErr) {
    // If the assigned_order column doesn't exist yet, retry without it
    if (/assigned_order/.test(sessionErr.message)) {
      const { error: retryErr } = await svc.from('iat_session_results').insert({
        iat_id:         iatid,
        participant_id: user.id,
        session_id:     body.sessionId,
        d_score:        body.dScore,
        computed_at:    new Date().toISOString(),
      })
      if (retryErr) {
        return NextResponse.json(
          { error: `Failed to save session result: ${retryErr.message}` },
          { status: 500 },
        )
      }
    } else {
      return NextResponse.json(
        { error: `Failed to save session result: ${sessionErr.message}` },
        { status: 500 },
      )
    }
  }

  // ── Log activity ──────────────────────────────────────────────────────────
  await logActivity(user.id, 'completion', 'iat', iatid, {
    iat_id:         iatid,
    d_score:        body.dScore,
    excluded:       body.excluded,
    assigned_order: body.assignedOrder,
    trial_count:    body.trials.length,
  })

  return NextResponse.json({ ok: true })
}
