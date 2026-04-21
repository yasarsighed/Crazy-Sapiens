import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, CheckCircle, Clock, Users, Timer, FlaskConical, Trophy } from 'lucide-react'
import { LeaveStudyButton } from '@/components/leave-study-button'

export default async function ParticipantDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch active enrollments
  const { data: enrollments } = await supabase
    .from('study_enrollments')
    .select('study_id, status, consented_at')
    .eq('participant_id', user.id)
    .eq('status', 'active')

  const studyIds = enrollments?.map(e => e.study_id) ?? []

  // Track which studies have been consented to
  const consentedStudyIds = new Set(
    (enrollments ?? []).filter(e => e.consented_at).map(e => e.study_id)
  )

  // Fetch study names and consent text for grouping
  const { data: studyDetails } = studyIds.length > 0
    ? await supabase.from('studies').select('id, title, consent_text').in('id', studyIds)
    : { data: [] }
  const studyById = Object.fromEntries(
    (studyDetails ?? []).map(s => [s.id, s as { id: string; title: string; consent_text: string | null }])
  )

  // Fetch active questionnaires
  const { data: questionnaires } = studyIds.length > 0
    ? await supabase
        .from('questionnaire_instruments')
        .select('id, study_id, title, instructions, estimated_duration_minutes, validated_scale_name, status')
        .in('study_id', studyIds)
        .eq('status', 'active')
    : { data: [] }

  // Completed questionnaires
  const { data: completedResults } = await supabase
    .from('questionnaire_scored_results')
    .select('questionnaire_id')
    .eq('participant_id', user.id)
    .eq('is_complete', true)
  const completedIds = new Set(completedResults?.map(r => r.questionnaire_id) ?? [])

  const pendingQ   = questionnaires?.filter(q => !completedIds.has(q.id)) ?? []
  const completedQ = questionnaires?.filter(q =>  completedIds.has(q.id)) ?? []

  // Fetch active sociograms
  const { data: sociograms } = studyIds.length > 0
    ? await supabase
        .from('sociogram_instruments')
        .select('id, study_id, title, status')
        .in('study_id', studyIds)
        .eq('status', 'active')
    : { data: [] }

  // Submitted sociograms
  const { data: submittedSociograms } = await supabase
    .from('sociogram_participants')
    .select('sociogram_id')
    .eq('participant_id', user.id)
    .eq('has_submitted', true)
  const submittedSociogramIds = new Set(submittedSociograms?.map(s => s.sociogram_id) ?? [])

  const pendingSoc   = sociograms?.filter(s => !submittedSociogramIds.has(s.id)) ?? []
  const completedSoc = sociograms?.filter(s =>  submittedSociogramIds.has(s.id)) ?? []

  // Fetch IATs
  const { data: iats } = studyIds.length > 0
    ? await supabase.from('iat_instruments').select('id, study_id, title').in('study_id', studyIds)
    : { data: [] }

  // Completed IATs — check BOTH session_results (D-score saved) AND trial_log (any trials = attempted)
  // The trial_log is the ground truth; session_results can be absent if the save timed out.
  const iatIds = (iats ?? []).map((i: any) => i.id)
  const [{ data: completedIatSessions }, { data: completedIatTrials }] = await Promise.all([
    iatIds.length > 0
      ? supabase.from('iat_session_results').select('iat_id').eq('participant_id', user.id).in('iat_id', iatIds)
      : { data: [] },
    iatIds.length > 0
      ? supabase.from('iat_trial_log').select('iat_id').eq('participant_id', user.id).in('iat_id', iatIds).limit(iatIds.length * 10)
      : { data: [] },
  ])
  const completedIatIds = new Set([
    ...(completedIatSessions ?? []).map((r: any) => r.iat_id),
    ...(completedIatTrials  ?? []).map((r: any) => r.iat_id),
  ])
  const pendingIat   = (iats ?? []).filter((i: any) => !completedIatIds.has(i.id))
  const completedIat = (iats ?? []).filter((i: any) =>  completedIatIds.has(i.id))

  // Total pending count
  const totalPending   = pendingQ.length  + pendingSoc.length  + pendingIat.length
  const totalCompleted = completedQ.length + completedSoc.length + completedIat.length

  // Build per-study pending/completed maps
  const studyPendingMap: Record<string, {
    questionnaires: typeof pendingQ,
    sociograms: typeof pendingSoc,
    iats: typeof pendingIat,
    completedCount: number,
    totalCount: number,
  }> = {}

  for (const studyId of studyIds) {
    const studyPendingQ   = pendingQ.filter(q => q.study_id === studyId)
    const studyPendingSoc = pendingSoc.filter(s => s.study_id === studyId)
    const studyPendingI   = pendingIat.filter((i: any) => i.study_id === studyId)
    const studyCompQ      = completedQ.filter(q => q.study_id === studyId)
    const studyCompSoc    = completedSoc.filter(s => s.study_id === studyId)
    const studyCompI      = completedIat.filter((i: any) => i.study_id === studyId)
    const allInStudy      = [
      ...(questionnaires ?? []).filter(q => q.study_id === studyId),
      ...(sociograms ?? []).filter(s => s.study_id === studyId),
      ...(iats ?? []).filter((i: any) => i.study_id === studyId),
    ]
    studyPendingMap[studyId] = {
      questionnaires: studyPendingQ,
      sociograms:     studyPendingSoc,
      iats:           studyPendingI,
      completedCount: studyCompQ.length + studyCompSoc.length + studyCompI.length,
      totalCount:     allInStudy.length,
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground mb-1">Your instruments</h1>
        <p className="text-sm text-muted-foreground">
          {totalPending > 0
            ? `${totalPending} pending. Take your time — there are no wrong answers.`
            : 'All done. Science thanks you.'}
        </p>
      </div>

      {/* No enrollment state */}
      {studyIds.length === 0 && (
        <div className="text-center py-16">
          <p className="font-serif text-xl mb-2">You are not enrolled in any studies.</p>
          <p className="text-sm text-muted-foreground">
            Your researcher will send you an invitation link when you are added.
          </p>
        </div>
      )}

      {/* Per-study sections */}
      {studyIds.map(studyId => {
        const study = studyById[studyId]
        const { questionnaires: qs, sociograms: ss, iats: is, completedCount, totalCount } = studyPendingMap[studyId]
        const hasConsented = consentedStudyIds.has(studyId)
        const pendingCount = qs.length + ss.length + is.length
        const isAllDone = pendingCount === 0 && totalCount > 0 && completedCount === totalCount

        return (
          <div key={studyId} className="mb-8">
            {/* Study header */}
            <div className="flex items-center gap-2 pb-2 border-b border-border mb-4">
              <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {study?.title ?? 'Study'}
              </p>
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-[10px] ml-auto">
                  {pendingCount} remaining
                </Badge>
              )}
            </div>

            {/* Study complete card */}
            {isAllDone && (
              <div className="border border-[#52B788]/30 bg-[#52B788]/5 rounded-xl p-5 flex items-center gap-4 mb-3">
                <Trophy className="w-8 h-8 text-[#52B788] shrink-0" />
                <div>
                  <p className="font-serif text-base font-semibold text-foreground">All done — thank you!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You have completed all instruments in this study.
                    Your contributions support meaningful research.
                  </p>
                </div>
              </div>
            )}

            {/* Pending instruments */}
            {pendingCount > 0 && (
              <div className="space-y-3 mb-2">
                {/* Questionnaires */}
                {qs.map(q => (
                  <div
                    key={q.id}
                    className="border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <ClipboardList className="w-4 h-4 text-[#457B9D] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{q.title}</p>
                        {q.validated_scale_name && (
                          <Badge variant="outline" className="text-[10px] mt-1">{q.validated_scale_name}</Badge>
                        )}
                        {q.estimated_duration_minutes && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />~{q.estimated_duration_minutes} min
                          </p>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/participant/questionnaire/${q.id}`}>Begin</Link>
                    </Button>
                  </div>
                ))}

                {/* Sociograms */}
                {ss.map(s => (
                  <div
                    key={s.id}
                    className="border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Users className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">Sociogram</Badge>
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/participant/sociogram/${s.id}`}>Begin</Link>
                    </Button>
                  </div>
                ))}

                {/* IATs */}
                {is.map((iat: any) => (
                  <div
                    key={iat.id}
                    className="border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Timer className="w-4 h-4 text-[#F4A261] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{iat.title}</p>
                        <Badge variant="outline" className="text-[10px] mt-1 border-[#F4A261] text-[#F4A261]">IAT</Badge>
                        <p className="text-xs text-amber-600 mt-1">⌨ Requires physical keyboard</p>
                      </div>
                    </div>
                    <Button asChild size="sm" className="bg-[#F4A261] hover:bg-[#e8934a] text-white border-0">
                      <Link href={`/participant/iat/${iat.id}`}>Begin</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Completed items for this study */}
            {completedCount > 0 && (
              <div className="space-y-2 mt-3">
                {completedQ.filter(q => q.study_id === studyId).map(q => (
                  <div key={q.id} className="flex items-center gap-3 py-1.5 opacity-60">
                    <CheckCircle className="w-3.5 h-3.5 text-[#52B788] shrink-0" />
                    <p className="text-xs text-foreground">{q.title}</p>
                    <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
                  </div>
                ))}
                {completedSoc.filter(s => s.study_id === studyId).map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-1.5 opacity-60">
                    <CheckCircle className="w-3.5 h-3.5 text-[#52B788] shrink-0" />
                    <p className="text-xs text-foreground">{s.title}</p>
                    <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
                  </div>
                ))}
                {completedIat.filter((i: any) => i.study_id === studyId).map((iat: any) => (
                  <div key={iat.id} className="flex items-center gap-3 py-1.5 opacity-60">
                    <CheckCircle className="w-3.5 h-3.5 text-[#52B788] shrink-0" />
                    <p className="text-xs text-foreground">{iat.title}</p>
                    <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Leave study */}
            <LeaveStudyButton studyId={studyId} studyTitle={study?.title ?? 'this study'} />
          </div>
        )
      })}
    </div>
  )
}
