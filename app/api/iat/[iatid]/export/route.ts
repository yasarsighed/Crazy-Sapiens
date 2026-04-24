import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toCSV, toCSVRow } from '@/lib/csv'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ iatid: string }> },
) {
  const { iatid } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['researcher', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch instrument metadata
  const { data: instrument } = await supabase
    .from('iat_instruments')
    .select('id, title, study_id, iat_type, concept_a_label, concept_b_label, attribute_a_label, attribute_b_label')
    .eq('id', iatid)
    .single()

  if (!instrument) return NextResponse.json({ error: 'IAT not found' }, { status: 404 })

  // Verify ownership
  const { data: study } = await supabase
    .from('studies').select('created_by').eq('id', instrument.study_id).single()
  if (!study || (profile.role !== 'admin' && study.created_by !== user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch sessions and trials in parallel; each falls back if optional columns missing
  const [sessionsResult, trialsResult] = await Promise.all([
    supabase
      .from('iat_session_results')
      .select('participant_id, session_id, d_score, assigned_order, excluded, exclusion_reason, computed_at')
      .eq('iat_id', iatid)
      .order('computed_at', { ascending: true }),
    supabase
      .from('iat_trial_log')
      .select('participant_id, session_id, block_number, block_label, block_type, trial_number, stimulus_text, stimulus_category, correct_key, pressed_key, response_time_ms, is_correct, is_too_fast, excluded_from_scoring, created_at')
      .eq('iat_id', iatid)
      .order('participant_id', { ascending: true })
      .order('block_number',   { ascending: true })
      .order('trial_number',   { ascending: true }),
  ])

  // Fall back to minimal column set if new columns not yet in this deployment
  let sessions: any[] | null = sessionsResult.data
  if (sessionsResult.error) {
    const { data } = await supabase
      .from('iat_session_results')
      .select('participant_id, session_id, d_score, computed_at')
      .eq('iat_id', iatid)
      .order('computed_at', { ascending: true })
    sessions = data
  }

  let trials: any[] | null = trialsResult.data
  if (trialsResult.error && (trialsResult.error.message.includes('block_type') || trialsResult.error.message.includes('block_label'))) {
    const { data } = await supabase
      .from('iat_trial_log')
      .select('participant_id, session_id, block_number, trial_number, stimulus_text, stimulus_category, correct_key, pressed_key, response_time_ms, is_correct, is_too_fast, excluded_from_scoring, created_at')
      .eq('iat_id', iatid)
      .order('participant_id', { ascending: true })
      .order('block_number',   { ascending: true })
      .order('trial_number',   { ascending: true })
    trials = data
  }

  const sessionMap: Record<string, { d_score: number | null; assigned_order?: string; excluded?: boolean; exclusion_reason?: string; computed_at: string }> =
    Object.fromEntries((sessions ?? []).map((s: any) => [s.participant_id, s]))

  // Fetch participant profiles
  const participantIds = [...new Set((trials ?? []).map((t: any) => t.participant_id))]
  const { data: profiles } = participantIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', participantIds)
    : { data: [] }
  const profileMap: Record<string, { full_name: string; email: string }> =
    Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  if (!trials?.length) {
    return new Response('No trial data collected yet.', {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Columns designed for direct import into SPSS / R / JASP.
  // D-score and assigned_order are repeated on every row for convenience.
  const headers = [
    'participant_id',
    'participant_name',
    'participant_email',
    'iat_id',
    'iat_title',
    'iat_type',
    'session_id',
    'assigned_order',       // 'A' or 'B' — counterbalancing condition
    'd_score',              // D2 algorithm (Greenwald 2003); null if excluded
    'excluded',             // 1 if session excluded (>10% fast responses)
    'exclusion_reason',
    'block_number',         // 1–7
    'block_type',           // practice_target | practice_attribute | critical_practice | critical_test | reversal_practice
    'block_label',
    'trial_number',
    'stimulus_text',
    'stimulus_category',    // conceptA | conceptB | attrA | attrB
    'correct_key',          // e or i
    'pressed_key',
    'response_time_ms',     // raw RT; cap at 10 000 ms for D2
    'is_correct',
    'is_too_fast',          // RT < 300 ms; >10% → session excluded
    'excluded_from_scoring', // true for blocks 1, 2, 5 (not used in D2)
    'computed_at',
  ]

  const rows = (trials ?? []).map((t: any) => {
    const sess    = sessionMap[t.participant_id]
    const profile = profileMap[t.participant_id] ?? { full_name: '', email: '' }
    return [
      t.participant_id,
      profile.full_name,
      profile.email,
      iatid,
      instrument.title,
      instrument.iat_type ?? '',
      t.session_id,
      sess?.assigned_order ?? '',
      sess?.d_score ?? '',
      sess?.excluded ? '1' : '0',
      sess?.exclusion_reason ?? '',
      t.block_number,
      t.block_type ?? '',
      t.block_label ?? '',
      t.trial_number,
      t.stimulus_text,
      t.stimulus_category,
      t.correct_key,
      t.pressed_key,
      t.response_time_ms,
      t.is_correct ? '1' : '0',
      t.is_too_fast ? '1' : '0',
      t.excluded_from_scoring ? '1' : '0',
      sess?.computed_at ?? '',
    ]
  })

  const csv = toCSV(headers, rows)
  const safeTitle = instrument.title.replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `IAT_trials_${safeTitle}_${new Date().toISOString().split('T')[0]}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
