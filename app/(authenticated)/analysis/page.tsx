import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DataExplorer } from './DataExplorer'
import type {
  ParticipantProfile, QResult, IATResult,
  QInstrument, IATInstrument, Study, Enrollment,
} from './DataExplorer'

export default async function AnalysisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // ── Studies ──────────────────────────────────────────────────────────────
  const studiesQuery = supabase
    .from('studies')
    .select('id, title')
    .order('created_at', { ascending: false })
  if (!isAdmin) studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery
  const studyIds = (studies ?? []).map(s => s.id)

  if (!studyIds.length) {
    return (
      <div className="p-6 lg:p-8 max-w-xl">
        <h1 className="font-serif text-2xl mb-1">Data Explorer</h1>
        <p className="text-sm text-muted-foreground mb-8">Group and compare all your measures.</p>
        <p className="text-muted-foreground text-sm">No studies yet — create one and collect data to explore it here.</p>
      </div>
    )
  }

  // ── Instruments ───────────────────────────────────────────────────────────
  const [qInstrRes, iatInstrRes] = await Promise.all([
    supabase
      .from('questionnaire_instruments')
      .select('id, title, validated_scale_name, study_id')
      .in('study_id', studyIds),
    supabase
      .from('iat_instruments')
      .select('id, title, iat_type, study_id')
      .in('study_id', studyIds),
  ])

  const qInstruments:   QInstrument[]   = qInstrRes.data   ?? []
  const iatInstruments: IATInstrument[] = iatInstrRes.data ?? []
  const qIds   = qInstruments.map(q => q.id)
  const iatIds = iatInstruments.map(i => i.id)

  // ── Results + enrollments (parallel) ─────────────────────────────────────
  const [qResultsRes, iatResultsRes, enrollRes] = await Promise.all([
    qIds.length
      ? supabase
          .from('questionnaire_scored_results')
          .select('participant_id, questionnaire_id, total_score, severity_label')
          .in('questionnaire_id', qIds)
          .eq('is_complete', true)
      : Promise.resolve({ data: [] }),
    iatIds.length
      ? supabase
          .from('iat_session_results')
          .select('participant_id, iat_id, d_score')
          .in('iat_id', iatIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('study_enrollments')
      .select('study_id, participant_id')
      .in('study_id', studyIds)
      .eq('status', 'active'),
  ])

  const qResults:    QResult[]    = (qResultsRes.data   ?? []) as QResult[]
  const iatResults:  IATResult[]  = (iatResultsRes.data ?? []) as IATResult[]
  const enrollments: Enrollment[] = (enrollRes.data     ?? []) as Enrollment[]

  // ── Participant profiles ──────────────────────────────────────────────────
  const participantIds = [...new Set(enrollments.map(e => e.participant_id))]
  const participants: ParticipantProfile[] = participantIds.length
    ? ((await supabase
        .from('profiles')
        .select('id, full_name, gender, date_of_birth, education_level, occupation')
        .in('id', participantIds)).data ?? []) as ParticipantProfile[]
    : []

  return (
    <DataExplorer
      studies={studies as Study[]}
      participants={participants}
      qResults={qResults}
      qInstruments={qInstruments}
      iatResults={iatResults}
      iatInstruments={iatInstruments}
      enrollments={enrollments}
    />
  )
}
