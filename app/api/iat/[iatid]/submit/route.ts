import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/log-activity'
import { getIATType, bandForD } from '@/lib/iat-types'

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

  // The client's WordCategory type ('conceptA' | 'conceptB' | 'attrA' | 'attrB')
  // doesn't match the live iat_trial_log.stimulus_category CHECK constraint
  // ('concept_a' | 'concept_b' | 'attribute_a' | 'attribute_b') — every trial
  // insert was failing on this until the mapping below was added.
  const STIMULUS_CATEGORY_MAP: Record<string, string> = {
    conceptA: 'concept_a',
    conceptB: 'concept_b',
    attrA:    'attribute_a',
    attrB:    'attribute_b',
  }

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
    // The live table has a NOT NULL + CHECK block_type column ('practice' |
    // 'test') not present in the tracked supabase/schema.sql — every real
    // submission was failing this insert until this was added. Values
    // confirmed against existing seeded rows. Derived from the same
    // practice/scored distinction the client already computes (blocks
    // 3,4,6,7 are scored/test; 1,2,5 are practice).
    block_type:           t.excludedFromScoring ? 'practice' : 'test',
    trial_number:         t.trialNumber,
    stimulus_text:        t.stimulusText,
    stimulus_category:    STIMULUS_CATEGORY_MAP[t.stimulusCategory] ?? t.stimulusCategory,
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

  // ── Clinical alert (non-fatal, but never silent) ──────────────────────────
  // Computed server-side from the IAT's own iat_type — not trusted from the
  // client — so this can't be spoofed or accidentally omitted, and each IAT
  // variant is judged against ITS OWN clinical band (only Death/Suicide has
  // one; a high D-score on e.g. the Gender-Career IAT is not a risk signal
  // and must never fire this). Before this fix, no IAT submission of any
  // kind ever created a clinical_alerts_log row, so a participant scoring in
  // the clinical band on the Death/Suicide IAT produced no alert, no
  // notification, nothing actionable for the research team.
  if (body.dScore !== null && !body.excluded) {
    const { data: iatInstrument } = await svc
      .from('iat_instruments')
      .select('study_id, iat_type, title')
      .eq('id', iatid)
      .single()

    if (iatInstrument) {
      const iatType = getIATType(iatInstrument.iat_type)
      const band = bandForD(body.dScore, iatType.dscore_bands)

      if (band.clinical) {
        // Column set + allowed values verified directly against the live
        // table (2026-08-19): the tracked supabase/schema.sql is stale here
        // (lists severity/message/triggered_by columns that DO NOT actually
        // exist, is missing several that do, and doesn't show the CHECK
        // constraints on alert_level/alert_type at all). alert_type must be
        // one of total_score_threshold | subscale_threshold | item_level_flag
        // | clinical_cutoff_exceeded | custom_rule — 'clinical_cutoff_exceeded'
        // is the correct fit for a D-score crossing the clinical band.
        const { error: alertErr } = await svc.from('clinical_alerts_log').insert({
          study_id:            iatInstrument.study_id,
          participant_id:      user.id,
          alert_level:         'critical',
          alert_type:          'clinical_cutoff_exceeded',
          trigger_description: `${iatInstrument.title}: ${band.label} (D = ${body.dScore.toFixed(2)}). ${iatType.clinicalNote}`,
          trigger_score:       body.dScore,
          trigger_threshold:   iatType.dscore_bands.find(b => b.clinical)?.min ?? 0.65,
          scale_name:          iatType.name,
          acknowledged:        false,
          resolved:            false,
          escalated:           false,
        })
        if (alertErr) {
          // Never let this fail silently — this is the single highest-stakes
          // signal the platform collects. If the insert schema drifts, we
          // need to know immediately, not discover it retroactively.
          console.error(`[iat/submit] Failed to insert clinical alert for participant ${user.id}, iat ${iatid}:`, alertErr.message)
        }
      }
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
