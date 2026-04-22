import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',')
}

const HEADER = csvRow([
  'instrument_type', 'instrument_title', 'variable', 'description',
  'data_type', 'scale', 'direction', 'response_options', 'notes',
])

const META_ROWS = [
  csvRow(['meta', '(all)', 'participant_id', 'Pseudonymised participant identifier (Supabase UUID)', 'UUID', '—', '—', '—', 'Join key across all instrument exports']),
  csvRow(['meta', '(all)', 'submitted_at',   'ISO 8601 timestamp when participant submitted the instrument', 'datetime', '—', '—', '—', 'Use for ordering / response-time checks']),
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['researcher', 'admin', 'supervisor'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: study } = await supabase
    .from('studies').select('id, title').eq('id', studyId).single()
  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  const [qRes, iatRes, socioRes] = await Promise.all([
    supabase.from('questionnaire_instruments').select('id, title, validated_scale_name, clinical_alert_threshold').eq('study_id', studyId),
    supabase.from('iat_instruments').select('id, title').eq('study_id', studyId),
    supabase.from('sociogram_instruments').select('id, title').eq('study_id', studyId),
  ])

  // Fetch all questionnaire items in one query (avoid N+1)
  const qIds = (qRes.data ?? []).map(q => q.id)
  const { data: allItems } = qIds.length
    ? await supabase
        .from('questionnaire_items')
        .select('questionnaire_id, item_code, item_text, display_order, is_reverse_scored, response_options, clinical_flag_threshold')
        .in('questionnaire_id', qIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
    : { data: [] }

  // Group items by questionnaire_id
  const itemsByQid = new Map<string, typeof allItems>()
  for (const it of allItems ?? []) {
    const bucket = itemsByQid.get(it.questionnaire_id) ?? []
    bucket.push(it)
    itemsByQid.set(it.questionnaire_id, bucket)
  }

  const rows: string[] = [HEADER, ...META_ROWS]

  for (const qn of qRes.data ?? []) {
    rows.push(csvRow([
      'questionnaire', qn.title, 'total_score',
      'Sum of scored_value across all items (reverse-scored items already flipped)',
      'integer', qn.validated_scale_name ?? 'custom', 'higher = more of construct', '—',
      qn.clinical_alert_threshold !== null ? `Clinical alert fires at ≥ ${qn.clinical_alert_threshold}` : '',
    ]))
    rows.push(csvRow([
      'questionnaire', qn.title, 'severity_label',
      'Clinical severity band derived from total_score (see scale definition)',
      'categorical', qn.validated_scale_name ?? 'custom', '—', '—', '',
    ]))
    for (const it of itemsByQid.get(qn.id) ?? []) {
      const opts = Array.isArray(it.response_options)
        ? (it.response_options as { value: number; label: string }[]).map(o => `${o.value}=${o.label}`).join(' | ')
        : ''
      rows.push(csvRow([
        'questionnaire', qn.title, `item_${it.item_code ?? it.display_order}`,
        it.item_text, 'integer', qn.validated_scale_name ?? 'custom',
        it.is_reverse_scored ? 'reverse-scored (flipped before sum)' : 'forward',
        opts,
        it.clinical_flag_threshold != null ? `Item-level clinical flag at ≥ ${it.clinical_flag_threshold}` : '',
      ]))
    }
  }

  for (const iat of iatRes.data ?? []) {
    rows.push(
      csvRow(['iat', iat.title, 'd_score',        'IAT D2 score (Greenwald 2003). Positive = faster Self–Death pairings.', 'float', '—', 'sign-corrected across block-order A/B', '—', 'Clinical threshold D ≥ 0.65 (Millner 2019)']),
      csvRow(['iat', iat.title, 'assigned_order', 'Counterbalancing condition: A = compatible-first, B = incompatible-first', 'categorical (A|B)', '—', '—', 'A,B', 'Randomly assigned at session start']),
      csvRow(['iat', iat.title, 'response_time_ms','Per-trial reaction time in milliseconds (iat_trial_log)', 'integer ms', '—', '—', '—', 'Trials <300ms or >10000ms excluded from D2 per Greenwald algorithm']),
      csvRow(['iat', iat.title, 'is_correct',     "Whether the participant's first keypress matched the correct category", 'boolean', '—', '—', 'true,false', 'Error trials have a correction-time penalty in D2']),
    )
  }

  for (const so of socioRes.data ?? []) {
    rows.push(
      csvRow(['sociogram', so.title, 'nominator_id',      'Participant making the nomination (auth UID)',      'UUID', '—', '—', '—', '']),
      csvRow(['sociogram', so.title, 'nominee_id',        'Participant being nominated (auth UID)',            'UUID', '—', '—', '—', '']),
      csvRow(['sociogram', so.title, 'relationship_type', 'Researcher-defined nomination category (e.g. close friend, advice seeker)', 'categorical', '—', '—', '—', 'Negative-valence types are edge-dashed in the visualisation']),
    )
  }

  const filename = `codebook_${study.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
