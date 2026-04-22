import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Circle, ClipboardList, Timer, Users, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function ParticipantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch studies
  const studiesQuery = supabase.from('studies').select('id, title, status')
  if (!isAdmin) studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery

  const studyIds = (studies ?? []).map((s: any) => s.id)

  if (studyIds.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="font-serif text-2xl mb-1">Participants</h1>
        <p className="text-sm text-muted-foreground mb-12">The brave ones.</p>
        <div className="text-center py-24">
          <p className="font-serif text-xl mb-2">No studies yet.</p>
          <p className="text-sm italic text-muted-foreground">Create a study first, then add participants.</p>
        </div>
      </div>
    )
  }

  // Fetch all enrollments for these studies
  const { data: enrollments } = await supabase
    .from('study_enrollments')
    .select('id, participant_id, study_id, status, enrolled_at')
    .in('study_id', studyIds)
    .order('enrolled_at', { ascending: false })

  const participantIds = [...new Set((enrollments ?? []).map((e: any) => e.participant_id))]

  // Fetch participant profiles
  const { data: profiles } = participantIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', participantIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  const studyMap   = Object.fromEntries((studies ?? []).map((s: any) => [s.id, s]))

  // Fetch all instruments for these studies
  const [qRes, socRes, iatRes] = await Promise.all([
    supabase.from('questionnaire_instruments').select('id, title, study_id').in('study_id', studyIds),
    supabase.from('sociogram_instruments').select('id, title, study_id').in('study_id', studyIds),
    supabase.from('iat_instruments').select('id, title, study_id').in('study_id', studyIds),
  ])

  // Instruments grouped by study
  type Instrument = { id: string; title: string; type: 'questionnaire' | 'sociogram' | 'iat' }
  const instrumentsByStudy: Record<string, Instrument[]> = {}
  for (const id of studyIds) instrumentsByStudy[id] = []
  for (const q of qRes.data ?? []) instrumentsByStudy[q.study_id]?.push({ id: q.id, title: q.title, type: 'questionnaire' })
  for (const s of socRes.data ?? []) instrumentsByStudy[s.study_id]?.push({ id: s.id, title: s.title, type: 'sociogram' })
  for (const i of iatRes.data ?? []) instrumentsByStudy[i.study_id]?.push({ id: i.id, title: i.title, type: 'iat' })

  // Fetch completion data
  const allQIds  = (qRes.data ?? []).map((q: any) => q.id)
  const allSocIds = (socRes.data ?? []).map((s: any) => s.id)
  const allIatIds = (iatRes.data ?? []).map((i: any) => i.id)

  const [qDoneRes, socDoneRes, iatDoneRes, alertsRes] = await Promise.all([
    allQIds.length > 0
      ? supabase.from('questionnaire_scored_results')
          .select('participant_id, questionnaire_id, total_score, severity_label')
          .in('questionnaire_id', allQIds)
          .eq('is_complete', true)
      : { data: [] },
    allSocIds.length > 0
      ? supabase.from('sociogram_participants')
          .select('participant_id, sociogram_id')
          .in('sociogram_id', allSocIds)
          .eq('has_submitted', true)
      : { data: [] },
    allIatIds.length > 0
      ? supabase.from('iat_trial_log')
          .select('participant_id, iat_id')
          .in('iat_id', allIatIds)
      : { data: [] },
    supabase.from('clinical_alerts_log')
      .select('participant_id, acknowledged')
      .in('study_id', studyIds),
  ])

  // Build completion sets
  const qDoneSet  = new Set((qDoneRes.data ?? []).map((r: any) => `${r.participant_id}:${r.questionnaire_id}`))
  const socDoneSet = new Set((socDoneRes.data ?? []).map((r: any) => `${r.participant_id}:${r.sociogram_id}`))
  const iatDoneSet = new Set((iatDoneRes.data ?? []).map((r: any) => `${r.participant_id}:${r.iat_id}`))

  // Questionnaire scores per participant per instrument
  const qScoreMap: Record<string, { score: number; severity: string | null }> = {}
  for (const r of qDoneRes.data ?? []) {
    qScoreMap[`${r.participant_id}:${r.questionnaire_id}`] = { score: r.total_score, severity: r.severity_label }
  }

  // Alerts per participant
  const alertsByPid: Record<string, { total: number; unack: number }> = {}
  for (const a of alertsRes.data ?? []) {
    if (!alertsByPid[a.participant_id]) alertsByPid[a.participant_id] = { total: 0, unack: 0 }
    alertsByPid[a.participant_id].total++
    if (!a.acknowledged) alertsByPid[a.participant_id].unack++
  }

  // Group enrollments by study
  const enrollmentsByStudy: Record<string, typeof enrollments> = {}
  for (const id of studyIds) enrollmentsByStudy[id] = []
  for (const e of enrollments ?? []) enrollmentsByStudy[e.study_id]?.push(e)

  const typeIcon  = { questionnaire: ClipboardList, sociogram: Users, iat: Timer }
  const typeColor = { questionnaire: '#457B9D', sociogram: '#2D6A4F', iat: '#F4A261' }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl">Participants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {participantIds.length} participant{participantIds.length !== 1 ? 's' : ''} across{' '}
          {studyIds.length} {studyIds.length === 1 ? 'study' : 'studies'}
        </p>
      </div>

      <div className="space-y-10">
        {studyIds.map(studyId => {
          const study       = studyMap[studyId]
          const studyEnrolls = enrollmentsByStudy[studyId] ?? []
          const instruments  = instrumentsByStudy[studyId] ?? []

          if (studyEnrolls.length === 0) return null

          return (
            <div key={studyId}>
              {/* Study header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-serif text-base font-semibold text-foreground">{study?.title}</h2>
                <Badge variant={study?.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {study?.status}
                </Badge>
                <Link href={`/studies/${studyId}`} className="text-xs text-muted-foreground hover:text-primary">
                  View study →
                </Link>
              </div>

              {instruments.length === 0 && (
                <p className="text-xs text-muted-foreground italic mb-4">No instruments added to this study yet.</p>
              )}

              {/* Participant table */}
              <div className="border border-border rounded-xl overflow-hidden">
                {/* Column header */}
                {instruments.length > 0 && (
                  <div className="flex items-center gap-2 bg-muted/40 px-4 py-2 border-b border-border">
                    <div className="w-52 shrink-0" />
                    {instruments.map(inst => {
                      const Icon  = typeIcon[inst.type]
                      const color = typeColor[inst.type]
                      return (
                        <div
                          key={inst.id}
                          className="flex-1 flex items-center gap-1 text-[10px] text-muted-foreground font-medium"
                          title={inst.title}
                        >
                          <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                          <span className="truncate">{inst.title}</span>
                        </div>
                      )
                    })}
                    <div className="w-20 text-[10px] text-muted-foreground font-medium text-right shrink-0">Alerts</div>
                  </div>
                )}

                {/* Participant rows */}
                {studyEnrolls.map((enrollment: any) => {
                  const pid     = enrollment.participant_id
                  const p       = profileMap[pid]
                  const alerts  = alertsByPid[pid]
                  const done    = instruments.filter(inst => {
                    if (inst.type === 'questionnaire') return qDoneSet.has(`${pid}:${inst.id}`)
                    if (inst.type === 'sociogram')     return socDoneSet.has(`${pid}:${inst.id}`)
                    if (inst.type === 'iat')           return iatDoneSet.has(`${pid}:${inst.id}`)
                    return false
                  }).length

                  return (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-2 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      {/* Participant identity */}
                      <Link href={`/participants/${pid}`} className="w-52 shrink-0 flex items-center gap-3 min-w-0 hover:opacity-90">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                          style={{ backgroundColor: '#2D6A4F' }}
                        >
                          {p?.full_name?.charAt(0) ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate hover:text-primary">{p?.full_name ?? 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{p?.email}</p>
                        </div>
                      </Link>

                      {/* Per-instrument completion */}
                      {instruments.map(inst => {
                        const completed =
                          inst.type === 'questionnaire' ? qDoneSet.has(`${pid}:${inst.id}`)
                          : inst.type === 'sociogram'   ? socDoneSet.has(`${pid}:${inst.id}`)
                          : iatDoneSet.has(`${pid}:${inst.id}`)

                        const qScore = inst.type === 'questionnaire'
                          ? qScoreMap[`${pid}:${inst.id}`]
                          : null

                        return (
                          <div key={inst.id} className="flex-1 flex flex-col items-center justify-center">
                            {completed ? (
                              <>
                                <CheckCircle className="w-4 h-4" style={{ color: typeColor[inst.type] }} />
                                {qScore && (
                                  <span className="text-[9px] text-muted-foreground mt-0.5">
                                    {qScore.score}{qScore.severity ? ` · ${qScore.severity}` : ''}
                                  </span>
                                )}
                              </>
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground/30" />
                            )}
                          </div>
                        )
                      })}

                      {/* Alert indicator */}
                      <div className="w-20 shrink-0 text-right">
                        {alerts ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${alerts.unack > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {alerts.unack > 0 ? `${alerts.unack} (!!)` : `${alerts.total} (ack)`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Completion summary */}
              {instruments.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-right">
                  {studyEnrolls.filter((e: any) => {
                    const pid = e.participant_id
                    return instruments.every(inst =>
                      inst.type === 'questionnaire' ? qDoneSet.has(`${pid}:${inst.id}`)
                      : inst.type === 'sociogram'   ? socDoneSet.has(`${pid}:${inst.id}`)
                      : iatDoneSet.has(`${pid}:${inst.id}`)
                    )
                  }).length} of {studyEnrolls.length} participants fully complete
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
