import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, CheckCircle, Clock, Users, Timer, FlaskConical, Trophy, User } from 'lucide-react'
import { LeaveStudyButton } from '@/components/leave-study-button'

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function ParticipantDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch active enrollments
  const { data: enrollments } = await supabase
    .from('study_enrollments')
    .select('study_id, status, consented_at')
    .eq('participant_id', user.id)
    .eq('status', 'active')

  const studyIds = enrollments?.map(e => e.study_id) ?? []
  const consentedStudyIds = new Set(
    (enrollments ?? []).filter(e => e.consented_at).map(e => e.study_id)
  )

  // Fetch study details + researcher info
  const { data: studyDetails } = studyIds.length > 0
    ? await supabase
        .from('studies')
        .select('id, title, description, created_by, profiles!studies_created_by_fkey(full_name, researcher_color, avatar_url)')
        .in('id', studyIds)
    : { data: [] }

  const studyById = Object.fromEntries(
    (studyDetails ?? []).map((s: any) => [s.id, s])
  )

  // Fetch instruments
  const { data: questionnaires } = studyIds.length > 0
    ? await supabase
        .from('questionnaire_instruments')
        .select('id, study_id, title, estimated_duration_minutes, validated_scale_name, status')
        .in('study_id', studyIds)
        .eq('status', 'active')
    : { data: [] }

  const { data: completedResults } = await supabase
    .from('questionnaire_scored_results')
    .select('questionnaire_id')
    .eq('participant_id', user.id)
    .eq('is_complete', true)
  const completedQIds = new Set(completedResults?.map(r => r.questionnaire_id) ?? [])

  const { data: sociograms } = studyIds.length > 0
    ? await supabase
        .from('sociogram_instruments')
        .select('id, study_id, title, status')
        .in('study_id', studyIds)
        .eq('status', 'active')
    : { data: [] }

  const { data: submittedSociograms } = await supabase
    .from('sociogram_participants')
    .select('sociogram_id')
    .eq('participant_id', user.id)
    .eq('has_submitted', true)
  const submittedSocIds = new Set(submittedSociograms?.map(s => s.sociogram_id) ?? [])

  const { data: iats } = studyIds.length > 0
    ? await supabase.from('iat_instruments').select('id, study_id, title').in('study_id', studyIds)
    : { data: [] }

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
    ...(completedIatTrials ?? []).map((r: any) => r.iat_id),
  ])

  // Build per-study instrument maps
  type StudyData = {
    pendingQ: typeof questionnaires extends null ? never[] : NonNullable<typeof questionnaires>
    pendingSoc: typeof sociograms extends null ? never[] : NonNullable<typeof sociograms>
    pendingIat: any[]
    completedQ: NonNullable<typeof questionnaires>
    completedSoc: NonNullable<typeof sociograms>
    completedIat: any[]
    totalCount: number
    completedCount: number
  }

  const studyMap: Record<string, StudyData> = {}
  for (const sid of studyIds) {
    const allQ = (questionnaires ?? []).filter(q => q.study_id === sid)
    const allS = (sociograms ?? []).filter(s => s.study_id === sid)
    const allI = (iats ?? []).filter((i: any) => i.study_id === sid)
    const pQ = allQ.filter(q => !completedQIds.has(q.id))
    const pS = allS.filter(s => !submittedSocIds.has(s.id))
    const pI = allI.filter((i: any) => !completedIatIds.has(i.id))
    const cQ = allQ.filter(q => completedQIds.has(q.id))
    const cS = allS.filter(s => submittedSocIds.has(s.id))
    const cI = allI.filter((i: any) => completedIatIds.has(i.id))
    studyMap[sid] = {
      pendingQ: pQ as any, pendingSoc: pS as any, pendingIat: pI,
      completedQ: cQ as any, completedSoc: cS as any, completedIat: cI,
      totalCount: allQ.length + allS.length + allI.length,
      completedCount: cQ.length + cS.length + cI.length,
    }
  }

  const grandTotalPending = studyIds.reduce((acc, sid) => {
    const d = studyMap[sid]
    return acc + d.pendingQ.length + d.pendingSoc.length + d.pendingIat.length
  }, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      {/* Welcome header */}
      <div className="flex items-center gap-4 mb-8">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#2D6A4F] flex items-center justify-center text-white font-medium text-lg shrink-0">
            {getInitials(profile?.full_name ?? null)}
          </div>
        )}
        <div>
          <h1 className="font-serif text-2xl text-foreground">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {grandTotalPending > 0
              ? `You have ${grandTotalPending} pending instrument${grandTotalPending > 1 ? 's' : ''}. Take your time.`
              : studyIds.length > 0
                ? 'All instruments completed. Science thanks you.'
                : 'You are not enrolled in any studies yet.'}
          </p>
        </div>
        <Link href="/participant/profile" className="ml-auto">
          <Button variant="outline" size="sm">
            <User className="w-3.5 h-3.5 mr-1.5" /> Profile
          </Button>
        </Link>
      </div>

      {/* No enrollment state */}
      {studyIds.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <FlaskConical className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="font-serif text-xl mb-2">Not enrolled in any studies</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your researcher will send you an invite link. Check your email or ask them directly.
          </p>
        </div>
      )}

      {/* Per-study cards */}
      <div className="space-y-6">
        {studyIds.map(sid => {
          const study = studyById[sid] as any
          const { pendingQ, pendingSoc, pendingIat, completedQ, completedSoc, completedIat, totalCount, completedCount } = studyMap[sid]
          const pendingCount = pendingQ.length + pendingSoc.length + pendingIat.length
          const isAllDone = totalCount > 0 && completedCount === totalCount
          const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
          const researcher = study?.profiles

          return (
            <div key={sid} className="border border-border rounded-2xl overflow-hidden">
              {/* Study header */}
              <div className="p-5 border-b border-border bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FlaskConical className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h2 className="font-serif text-base font-semibold text-foreground truncate">{study?.title ?? 'Study'}</h2>
                      {researcher && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {researcher.avatar_url ? (
                            <img src={researcher.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px]"
                              style={{ backgroundColor: researcher.researcher_color ?? '#2D6A4F' }}
                            >
                              {getInitials(researcher.full_name)}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">{researcher.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {totalCount > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-foreground">{completedCount}/{totalCount}</p>
                      <p className="text-[10px] text-muted-foreground">complete</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progressPct}%`,
                          backgroundColor: isAllDone ? '#52B788' : (researcher?.researcher_color ?? '#2D6A4F'),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Instruments */}
              <div className="p-5 space-y-3">
                {/* All done */}
                {isAllDone && (
                  <div className="flex items-center gap-3 p-4 bg-[#52B788]/10 border border-[#52B788]/30 rounded-xl">
                    <Trophy className="w-5 h-5 text-[#52B788] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">All done — thank you!</p>
                      <p className="text-xs text-muted-foreground">Your contributions support meaningful research.</p>
                    </div>
                  </div>
                )}

                {/* Pending questionnaires */}
                {pendingQ.map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between gap-3 p-3 border border-[#457B9D]/30 bg-[#457B9D]/5 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <ClipboardList className="w-4 h-4 text-[#457B9D] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{q.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {q.validated_scale_name && (
                            <span className="text-[10px] text-muted-foreground">{q.validated_scale_name}</span>
                          )}
                          {q.estimated_duration_minutes && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />~{q.estimated_duration_minutes} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/participant/questionnaire/${q.id}`}>Begin</Link>
                    </Button>
                  </div>
                ))}

                {/* Pending sociograms */}
                {pendingSoc.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3 border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <Users className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">Peer nomination network</p>
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0 bg-[#2D6A4F] hover:bg-[#235a41] text-white border-0">
                      <Link href={`/participant/sociogram/${s.id}`}>Begin</Link>
                    </Button>
                  </div>
                ))}

                {/* Pending IATs */}
                {pendingIat.map((iat: any) => (
                  <div key={iat.id} className="flex items-center justify-between gap-3 p-3 border border-[#F4A261]/30 bg-[#F4A261]/5 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <Timer className="w-4 h-4 text-[#F4A261] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{iat.title}</p>
                        <p className="text-[10px] text-amber-600">Requires physical keyboard</p>
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0 bg-[#F4A261] hover:bg-[#e8934a] text-white border-0">
                      <Link href={`/participant/iat/${iat.id}`}>Begin</Link>
                    </Button>
                  </div>
                ))}

                {/* Completed items */}
                {[...completedQ.map((q: any) => ({ ...q, _type: 'questionnaire' })),
                  ...completedSoc.map((s: any) => ({ ...s, _type: 'sociogram' })),
                  ...completedIat.map((i: any) => ({ ...i, _type: 'iat' }))
                ].filter(i => i.study_id === sid).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 px-3 opacity-50">
                    <CheckCircle className="w-3.5 h-3.5 text-[#52B788] shrink-0" />
                    <p className="text-xs text-foreground flex-1 truncate">{item.title}</p>
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-px">Done</span>
                  </div>
                ))}

                {totalCount === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4">No instruments added yet.</p>
                )}
              </div>

              {/* Leave study footer */}
              <div className="px-5 pb-4 border-t border-border pt-3">
                <LeaveStudyButton studyId={sid} studyTitle={study?.title ?? 'this study'} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
