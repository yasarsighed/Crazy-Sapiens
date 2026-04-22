import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Generate a per-study codebook CSV: every variable a researcher exports,
// with type, scale, direction, response options, and derivation. Reviewers
// ask for this at submission time; cheaper to regenerate on demand.

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Authorisation: must be researcher/admin/supervisor
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['researcher', 'admin', 'supervisor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: study } = await supabase
    .from('studies')
    .select('id, title')
    .eq('id', studyId)
    .single()
  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  const [qRes, iatRes, socioRes] = await Promise.all([
    supabase.from('questionnaire_instruments')
      .select('id, title, validated_scale_name, clinical_alert_threshold')
      .eq('study_id', studyId),
    supabase.from('iat_instruments')
      .select('id, title')
      .eq('study_id', studyId),
    supabase.from('sociogram_instruments')
      .select('id, title')
      .eq('study_id', studyId),
  ])

  const rows: string[] = []
  rows.push(csvRow([
    'instrument_type', 'instrument_title', 'variable', 'description',
    'data_type', 'scale', 'direction', 'response_options', 'notes',
  ]))

  // Identifiers (shared)
  rows.push(csvRow([
    'meta', '(all)', 'participant_id', 'Pseudonymised participant identifier (Supabase UUID)',
    'UUID', '—', '—', '—', 'Join key across all instrument exports',
  ]))
  rows.push(csvRow([
    'meta', '(all)', 'submitted_at', 'ISO 8601 timestamp when participant submitted the instrument',
    'datetime', '—', '—', '—', 'Use for ordering / response-time checks',
  ]))

  for (const qn of qRes.data ?? []) {
    const { data: items } = await supabase
      .from('questionnaire_items')
      .select('item_code, item_text, display_order, is_reverse_scored, response_options, clinical_flag_threshold')
      .eq('questionnaire_id', qn.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    rows.push(csvRow([
      'questionnaire', qn.title, 'total_score',
      'Sum of scored_value across all items (reverse-scored items already flipped)',
      'integer', qn.validated_scale_name ?? 'custom', 'higher = more of construct',
      '—',
      qn.clinical_alert_threshold !== null ? `Clinical alert fires at ≥ ${qn.clinical_alert_threshold}` : '',
    ]))
    rows.push(csvRow([
      'questionnaire', qn.title, 'severity_label',
      'Clinical severity band derived from total_score (see scale definition)',
      'categorical', qn.validated_scale_name ?? 'custom', '—', '—', '',
    ]))
    for (const it of items ?? []) {
      const opts = Array.isArray(it.response_options)
        ? it.response_options.map((o: any) => `${o.value}=${o.label}`).join(' | ')
        : ''
      rows.push(csvRow([
        'questionnaire', qn.title, `item_${it.item_code ?? it.display_order}`,
        it.item_text,
        'integer', qn.validated_scale_name ?? 'custom',
        it.is_reverse_scored ? 'reverse-scored (flipped before sum)' : 'forward',
        opts,
        it.clinical_flag_threshold !== null && it.clinical_flag_threshold !== undefined
          ? `Item-level clinical flag at ≥ ${it.clinical_flag_threshold}` : '',
      ]))
    }
  }

  for (const iat of iatRes.data ?? []) {
    rows.push(csvRow([
      'iat', iat.title, 'd_score',
      'IAT D2 score (Greenwald 2003). Positive = faster Self–Death pairings.',
      'float', '—', 'sign-corrected across block-order A/B', '—',
      'Clinical threshold D ≥ 0.65 (Millner 2019)',
    ]))
    rows.push(csvRow([
      'iat', iat.title, 'assigned_order',
      'Counterbalancing condition: A = compatible-first, B = incompatible-first',
      'categorical (A|B)', '—', '—', 'A,B', 'Randomly assigned at session start',
    ]))
    rows.push(csvRow([
      'iat', iat.title, 'response_time_ms',
      'Per-trial reaction time in milliseconds (iat_trial_log)',
      'integer ms', '—', '—', '—',
      'Trials <300ms or >10000ms excluded from D2 per Greenwald algorithm',
    ]))
    rows.push(csvRow([
      'iat', iat.title, 'is_correct',
      'Whether the participant\'s first keypress matched the correct category',
      'boolean', '—', '—', 'true,false',
      'Error trials have a correction-time penalty in D2',
    ]))
  }

  for (const so of socioRes.data ?? []) {
    rows.push(csvRow([
      'sociogram', so.title, 'nominator_id',
      'Participant making the nomination (auth UID)',
      'UUID', '—', '—', '—', '',
    ]))
    rows.push(csvRow([
      'sociogram', so.title, 'nominee_id',
      'Participant being nominated (auth UID)',
      'UUID', '—', '—', '—', '',
    ]))
    rows.push(csvRow([
      'sociogram', so.title, 'relationship_type',
      'Researcher-defined nomination category (e.g. close friend, advice seeker)',
      'categorical', '—', '—', '—',
      'Negative-valence types are edge-dashed in the visualisation',
    ]))
  }

  const csv = rows.join('\n')
  const filename = `codebook_${study.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
