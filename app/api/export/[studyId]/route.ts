import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSVRow(values: any[]): string {
  return values.map(escapeCSV).join(',')
}

function toCSV(headers: string[], rows: any[][]): string {
  return [headers.join(','), ...rows.map(toCSVRow)].join('\n')
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { studyId: string } }
) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Role check — only researcher or admin can export
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['researcher', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studyId } = params

  // Verify study exists and belongs to this user (or user is admin)
  const { data: study } = await supabase
    .from('studies')
    .select('id, title, created_by')
    .eq('id', studyId)
    .single()

  if (!study) {
    return NextResponse.json({ error: 'Study not found' }, { status: 404 })
  }

  if (profile.role !== 'admin' && study.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ─── Fetch questionnaire results ─────────────────────────────────────────────

  const { data: qInstruments } = await supabase
    .from('questionnaire_instruments')
    .select('id, title, validated_scale_name')
    .eq('study_id', studyId)

  const qIds = (qInstruments ?? []).map((q: any) => q.id)
  const qMap = Object.fromEntries((qInstruments ?? []).map((q: any) => [q.id, q]))

  const { data: qResults } = qIds.length > 0
    ? await supabase
        .from('questionnaire_scored_results')
        .select('questionnaire_id, participant_id, total_score, severity_label, is_complete, submitted_at')
        .in('questionnaire_id', qIds)
        .eq('is_complete', true)
        .order('submitted_at', { ascending: true })
    : { data: [] }

  // ─── Fetch IAT results ────────────────────────────────────────────────────────

  const { data: iatInstruments } = await supabase
    .from('iat_instruments')
    .select('id, title')
    .eq('study_id', studyId)

  const iatIds = (iatInstruments ?? []).map((i: any) => i.id)
  const iatMap = Object.fromEntries((iatInstruments ?? []).map((i: any) => [i.id, i]))

  // Try to fetch from iat_session_results (may not exist)
  const { data: iatResults } = iatIds.length > 0
    ? await supabase
        .from('iat_session_results')
        .select('iat_id, participant_id, d_score, computed_at')
        .in('iat_id', iatIds)
        .order('computed_at', { ascending: true })
    : { data: [] }

  // ─── Fetch sociogram nominations ──────────────────────────────────────────────

  const { data: socInstruments } = await supabase
    .from('sociogram_instruments')
    .select('id, title')
    .eq('study_id', studyId)

  const socIds = (socInstruments ?? []).map((s: any) => s.id)
  const socMap = Object.fromEntries((socInstruments ?? []).map((s: any) => [s.id, s]))

  const { data: socNominations } = socIds.length > 0
    ? await supabase
        .from('sociogram_nominations')
        .select('sociogram_id, nominator_id, nominee_id, score, submitted_at')
        .in('sociogram_id', socIds)
        .order('submitted_at', { ascending: true })
    : { data: [] }

  const { data: socParticipants } = socIds.length > 0
    ? await supabase
        .from('sociogram_participants')
        .select('id, display_name, participant_id, sociogram_id')
        .in('sociogram_id', socIds)
    : { data: [] }

  const socPartMap = Object.fromEntries(
    (socParticipants ?? []).map((p: any) => [p.id, p])
  )

  // ─── Fetch all participant profiles ──────────────────────────────────────────

  const allParticipantIds = [
    ...new Set([
      ...(qResults ?? []).map((r: any) => r.participant_id),
      ...(iatResults ?? []).map((r: any) => r.participant_id),
      ...(socParticipants ?? []).map((p: any) => p.participant_id),
    ]),
  ]

  const { data: profiles } = allParticipantIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', allParticipantIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  // ─── Build CSV sections ───────────────────────────────────────────────────────

  const sections: string[] = []
  const studyTitle = study.title.replace(/[^a-zA-Z0-9_-]/g, '_')

  // 1. Questionnaire results
  if ((qResults ?? []).length > 0) {
    sections.push('# QUESTIONNAIRE RESULTS')
    const qHeaders = [
      'participant_id', 'participant_name', 'participant_email',
      'questionnaire_id', 'questionnaire_title', 'scale',
      'total_score', 'severity', 'submitted_at',
    ]
    const qRows = (qResults ?? []).map((r: any) => {
      const profile = profileMap[r.participant_id]
      const q = qMap[r.questionnaire_id]
      return [
        r.participant_id,
        profile?.full_name ?? '',
        profile?.email ?? '',
        r.questionnaire_id,
        q?.title ?? '',
        q?.validated_scale_name ?? '',
        r.total_score,
        r.severity_label ?? '',
        r.submitted_at ?? '',
      ]
    })
    sections.push(toCSV(qHeaders, qRows))
  }

  // 2. IAT results
  if ((iatResults ?? []).length > 0) {
    sections.push('\n# IAT RESULTS (D-scores)')
    const iatHeaders = [
      'participant_id', 'participant_name', 'participant_email',
      'iat_id', 'iat_title', 'd_score', 'computed_at',
    ]
    const iatRows = (iatResults ?? []).map((r: any) => {
      const profile = profileMap[r.participant_id]
      const iat = iatMap[r.iat_id]
      return [
        r.participant_id,
        profile?.full_name ?? '',
        profile?.email ?? '',
        r.iat_id,
        iat?.title ?? '',
        r.d_score,
        r.computed_at ?? '',
      ]
    })
    sections.push(toCSV(iatHeaders, iatRows))
  }

  // 3. Sociogram nominations
  if ((socNominations ?? []).length > 0) {
    sections.push('\n# SOCIOGRAM NOMINATIONS')
    const socHeaders = [
      'sociogram_id', 'sociogram_title',
      'nominator_participant_id', 'nominator_name',
      'nominee_participant_id', 'nominee_name',
      'score', 'submitted_at',
    ]
    const socRows = (socNominations ?? []).map((n: any) => {
      const socPart = socMap[n.sociogram_id]
      const nominatorP = socPartMap[n.nominator_id]
      const nomineeP = socPartMap[n.nominee_id]
      const nominatorProfile = nominatorP ? profileMap[nominatorP.participant_id] : null
      const nomineeProfile = nomineeP ? profileMap[nomineeP.participant_id] : null
      return [
        n.sociogram_id,
        socPart?.title ?? '',
        nominatorP?.participant_id ?? n.nominator_id,
        nominatorP?.display_name ?? nominatorProfile?.full_name ?? '',
        nomineeP?.participant_id ?? n.nominee_id,
        nomineeP?.display_name ?? nomineeProfile?.full_name ?? '',
        n.score ?? '',
        n.submitted_at ?? '',
      ]
    })
    sections.push(toCSV(socHeaders, socRows))
  }

  if (sections.length === 0) {
    sections.push('# No data collected yet for this study.')
  }

  const csv = sections.join('\n')
  const filename = `${studyTitle}_export_${new Date().toISOString().split('T')[0]}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
