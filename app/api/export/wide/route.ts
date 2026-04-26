import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSVRow(values: unknown[]): string {
  return values.map(escapeCSV).join(',')
}

function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map(toCSVRow)].join('\n')
}

// ─── Questionnaire scoring (mirrors Python compute_q_score) ──────────────────

const SCALE_PARAMS: Record<string, { rmin: number; rmax: number }> = {
  'PHQ-9':  { rmin: 0, rmax: 3 },
  'GAD-7':  { rmin: 0, rmax: 3 },
  'AAQ-II': { rmin: 1, rmax: 7 },
  'MPFI':   { rmin: 1, rmax: 6 },
}

interface ItemRecord {
  id: string
  is_reverse_scored: boolean
  scoring_weight: number | null
}

interface ResponseRecord {
  participant_id: string
  item_id: string
  raw_response_numeric: number
}

function computeQScore(
  responses: ResponseRecord[],
  items: ItemRecord[],
  scaleName: string,
): number {
  const { rmin, rmax } = SCALE_PARAMS[scaleName] ?? { rmin: 1, rmax: 5 }
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))
  let total = 0
  for (const r of responses) {
    const item = itemMap[r.item_id]
    if (!item) continue
    const weight = item.scoring_weight ?? 1
    const scored = item.is_reverse_scored
      ? (rmax + rmin - r.raw_response_numeric) * weight
      : r.raw_response_numeric * weight
    total += scored
  }
  return total
}

// ─── D2 algorithm (Greenwald, Nosek & Banaji 2003) ───────────────────────────
// Mirrors the computeDScore function in the IAT participant page.

interface TrialRecord {
  participant_id: string
  block_number: number
  response_time_ms: number
  is_correct: boolean
}

function computeD2(
  trials: TrialRecord[],
  orderB: boolean,
): { d: number | null; excluded: boolean; reason?: string } {
  const scoringBlocks = [3, 4, 6, 7]
  const all = trials.filter(t => scoringBlocks.includes(t.block_number))
  if (all.length < 20) return { d: null, excluded: true, reason: `Only ${all.length} scoring-block trials (need ≥20)` }

  const capped = all.map(t => ({ ...t, rt: Math.min(t.response_time_ms, 10_000) }))
  const fastPct = capped.filter(t => t.rt < 300).length / capped.length
  if (fastPct > 0.10) return { d: null, excluded: true, reason: `${Math.round(fastPct * 100)}% of trials < 300 ms` }

  const b34 = capped.filter(t => t.block_number === 3 || t.block_number === 4)
  const b67 = capped.filter(t => t.block_number === 6 || t.block_number === 7)
  if (b34.length < 10 || b67.length < 10) return { d: null, excluded: true, reason: 'Fewer than 10 trials in a block pair' }

  const mean = (arr: { rt: number }[]) => arr.reduce((s, t) => s + t.rt, 0) / arr.length

  const mc34 = mean(b34.filter(t => t.is_correct))
  const mc67 = mean(b67.filter(t => t.is_correct))
  if (!isFinite(mc34) || !isFinite(mc67)) return { d: null, excluded: true, reason: 'No correct trials in a block pair' }

  const pen34 = b34.map(t => t.is_correct ? t.rt : mc34 + 600)
  const pen67 = b67.map(t => t.is_correct ? t.rt : mc67 + 600)

  const m34 = pen34.reduce((s, v) => s + v, 0) / pen34.length
  const m67 = pen67.reduce((s, v) => s + v, 0) / pen67.length

  const allPen = [...pen34, ...pen67]
  const grandMean = allPen.reduce((s, v) => s + v, 0) / allPen.length
  const pooledSD = Math.sqrt(allPen.reduce((s, v) => s + (v - grandMean) ** 2, 0) / allPen.length)

  if (pooledSD === 0) return { d: null, excluded: true, reason: 'Pooled SD = 0' }

  const rawD = (m67 - m34) / pooledSD
  const d = Math.round((orderB ? -rawD : rawD) * 10_000) / 10_000
  return { d, excluded: false }
}

// ─── In/out-degree (lightweight sociogram; no betweenness/eigenvector) ────────
// For full centrality metrics use the Python script.

interface NominationRecord {
  nominator_id: string
  nominee_id: string
}

function computeDegrees(nominations: NominationRecord[], allIds: string[]) {
  const inDeg:  Record<string, number> = Object.fromEntries(allIds.map(id => [id, 0]))
  const outDeg: Record<string, number> = Object.fromEntries(allIds.map(id => [id, 0]))
  for (const n of nominations) {
    outDeg[n.nominator_id] = (outDeg[n.nominator_id] ?? 0) + 1
    inDeg[n.nominee_id]    = (inDeg[n.nominee_id]    ?? 0) + 1
  }
  return { inDeg, outDeg }
}

// ─── Age helper ───────────────────────────────────────────────────────────────

function ageYears(dob: string | null): number | null {
  if (!dob) return null
  const dobDate = new Date(dob)
  const today   = new Date()
  const diff    = (today.getTime() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000)
  return Math.floor(diff)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth (user-scoped client) ──────────────────────────────────────────────
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // ── Study ──────────────────────────────────────────────────────────────────
  const studyId = req.nextUrl.searchParams.get('studyId')
  if (!studyId) return NextResponse.json({ error: 'studyId query param required' }, { status: 400 })

  // Use service-role client for all data access
  const sb = createServiceClient()

  const { data: study } = await sb
    .from('studies')
    .select('id, title, created_by')
    .eq('id', studyId)
    .single()

  if (!study) return NextResponse.json({ error: 'Study not found' }, { status: 404 })

  if (!isAdmin && study.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Enrollments + profiles ─────────────────────────────────────────────────
  const { data: enrollments } = await sb
    .from('study_enrollments')
    .select('participant_id, enrolled_at')
    .eq('study_id', studyId)

  const participantIds = (enrollments ?? []).map((e: { participant_id: string }) => e.participant_id)
  const enrolledAtMap  = Object.fromEntries(
    (enrollments ?? []).map((e: { participant_id: string; enrolled_at: string }) => [e.participant_id, e.enrolled_at])
  )

  const { data: profiles } = participantIds.length
    ? await sb
        .from('profiles')
        .select('id, full_name, email, gender, date_of_birth, education_level, occupation')
        .in('id', participantIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]))

  // ── Instruments ────────────────────────────────────────────────────────────
  const { data: qInstruments } = await sb
    .from('questionnaire_instruments')
    .select('id, title, validated_scale_name')
    .eq('study_id', studyId)

  const { data: iatInstruments } = await sb
    .from('iat_instruments')
    .select('id, title, iat_type')
    .eq('study_id', studyId)

  // ── Items and responses ────────────────────────────────────────────────────
  const qItemsMap:     Record<string, ItemRecord[]>     = {}
  const qResponsesMap: Record<string, ResponseRecord[]> = {}

  for (const q of (qInstruments ?? [])) {
    const { data: items } = await sb
      .from('questionnaire_items')
      .select('id, is_reverse_scored, scoring_weight')
      .eq('questionnaire_id', q.id)
      .eq('is_active', true)
    qItemsMap[q.id] = items ?? []

    if (participantIds.length) {
      const { data: resps } = await sb
        .from('questionnaire_item_responses')
        .select('participant_id, item_id, raw_response_numeric')
        .eq('questionnaire_id', q.id)
        .in('participant_id', participantIds)
      qResponsesMap[q.id] = (resps ?? []) as ResponseRecord[]
    } else {
      qResponsesMap[q.id] = []
    }
  }

  // ── IAT trials + assigned orders ───────────────────────────────────────────
  const iatTrialsMap: Record<string, TrialRecord[]> = {}
  const iatOrderMap:  Record<string, Record<string, boolean>> = {}  // iatId -> { participantId -> orderB }

  for (const iat of (iatInstruments ?? [])) {
    if (participantIds.length) {
      const { data: trials } = await sb
        .from('iat_trials')
        .select('participant_id, block_number, response_time_ms, is_correct')
        .eq('iat_id', iat.id)
        .in('participant_id', participantIds)
      iatTrialsMap[iat.id] = (trials ?? []) as TrialRecord[]

      const { data: sessions } = await sb
        .from('iat_session_results')
        .select('participant_id, assigned_order')
        .eq('iat_id', iat.id)
        .in('participant_id', participantIds)
      iatOrderMap[iat.id] = Object.fromEntries(
        (sessions ?? []).map((s: { participant_id: string; assigned_order: string }) => [
          s.participant_id,
          s.assigned_order === 'B',
        ])
      )
    } else {
      iatTrialsMap[iat.id] = []
      iatOrderMap[iat.id]  = {}
    }
  }

  // ── Sociogram ──────────────────────────────────────────────────────────────
  const { data: nominations } = await sb
    .from('sociogram_nominations')
    .select('nominator_id, nominee_id')
    .eq('study_id', studyId)

  const { inDeg, outDeg } = computeDegrees(nominations ?? [], participantIds)

  // ── Build header ───────────────────────────────────────────────────────────
  const fixedHeaders = [
    'participant_id', 'full_name', 'email', 'gender',
    'date_of_birth', 'age_years', 'education_level', 'occupation', 'enrolled_at',
  ]

  const qHeaders: string[] = []
  for (const q of (qInstruments ?? [])) {
    const scale = q.validated_scale_name ?? q.id.slice(0, 8)
    const abbrev = scale.replace(/-/g, '_').replace(/\s/g, '_').toLowerCase()
    qHeaders.push(`${abbrev}_total`, `${abbrev}_severity_label`, `${abbrev}_severity_category`)
  }

  const iatHeaders: string[] = []
  for (const iat of (iatInstruments ?? [])) {
    const slug = (iat.iat_type ?? iat.id.slice(0, 8)).replace(/-/g, '_')
    iatHeaders.push(`${slug}_d_score`, `${slug}_excluded`, `${slug}_excl_reason`)
  }

  const socioHeaders = [
    'socio_indegree', 'socio_outdegree',
    // betweenness/eigenvector/closeness omitted server-side — use Python script for full centrality
    'socio_note',
  ]

  const allHeaders = [...fixedHeaders, ...qHeaders, ...iatHeaders, ...socioHeaders]

  // ── Build rows ─────────────────────────────────────────────────────────────
  const csvRows: unknown[][] = []

  for (const pid of participantIds) {
    const prof: Record<string, unknown> = (profileMap[pid] as Record<string, unknown>) ?? {}

    const fixedVals: unknown[] = [
      pid,
      prof.full_name ?? null,
      prof.email     ?? null,
      prof.gender    ?? null,
      prof.date_of_birth ?? null,
      ageYears((prof.date_of_birth as string | null) ?? null),
      prof.education_level ?? null,
      prof.occupation      ?? null,
      enrolledAtMap[pid]   ?? null,
    ]

    const qVals: unknown[] = []
    for (const q of (qInstruments ?? [])) {
      const items     = qItemsMap[q.id] ?? []
      const allResps  = qResponsesMap[q.id] ?? []
      const myResps   = allResps.filter(r => r.participant_id === pid)

      if (!myResps.length || !items.length) {
        qVals.push(null, null, null)
      } else {
        const score   = computeQScore(myResps as ResponseRecord[], items, q.validated_scale_name ?? '')
        qVals.push(score, null, null)
        // Severity labels skipped server-side to keep bundle small — use Python for full labels
      }
    }

    const iatVals: unknown[] = []
    for (const iat of (iatInstruments ?? [])) {
      const allTrials = iatTrialsMap[iat.id] ?? []
      const myTrials  = allTrials.filter(t => t.participant_id === pid)

      if (!myTrials.length) {
        iatVals.push(null, null, null)
      } else {
        const orderB = iatOrderMap[iat.id]?.[pid] ?? false
        const { d, excluded, reason } = computeD2(myTrials, orderB)
        iatVals.push(d, excluded, reason ?? null)
      }
    }

    const socioVals: unknown[] = [
      inDeg[pid]  ?? 0,
      outDeg[pid] ?? 0,
      'use Python script for betweenness/closeness/eigenvector',
    ]

    csvRows.push([...fixedVals, ...qVals, ...iatVals, ...socioVals])
  }

  const csv = toCSV(allHeaders, csvRows)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="stress360_wide.csv"',
    },
  })
}
