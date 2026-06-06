import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList, CheckCircle2, Clock, Users, Timer,
  FlaskConical, Trophy, User, Sparkles, Star, ArrowRight, Lock,
} from 'lucide-react'
import { LeaveStudyButton } from '@/components/leave-study-button'

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Up late? 🌙'
  if (h < 12) return 'Good morning ☀️'
  if (h < 17) return 'Good afternoon 🌤️'
  return 'Good evening 🌙'
}

function ProgressRing({ pct, color = '#059669', size = 56 }: { pct: number; color?: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#D1FAE5" strokeWidth="6" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={pct === 100 ? color : color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={dash}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </svg>
  )
}

export default async function ParticipantDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const { data: enrollments } = await supabase
    .from('study_enrollments')
    .select('study_id, status, consented_at')
    .eq('participant_id', user.id)
    .eq('status', 'active')

  const studyIds = enrollments?.map(e => e.study_id) ?? []

  const { data: studyDetails } = studyIds.length > 0
    ? await supabase
        .from('studies')
        .select('id, title, description, created_by, profiles!studies_created_by_fkey(full_name, researcher_color, avatar_url)')
        .in('id', studyIds)
    : { data: [] }

  const studyById = Object.fromEntries((studyDetails ?? []).map((s: any) => [s.id, s]))

  // Instruments
  const [{ data: questionnaires }, { data: sociograms }, { data: iats }] = await Promise.all([
    studyIds.length
      ? supabase.from('questionnaire_instruments').select('id,study_id,title,estimated_duration_minutes,validated_scale_name,status').in('study_id', studyIds).eq('status', 'active')
      : { data: [] },
    studyIds.length
      ? supabase.from('sociogram_instruments').select('id,study_id,title,status').in('study_id', studyIds).eq('status', 'active')
      : { data: [] },
    studyIds.length
      ? supabase.from('iat_instruments').select('id,study_id,title').in('study_id', studyIds)
      : { data: [] },
  ])

  // Completed
  const { data: completedResults } = await supabase.from('questionnaire_scored_results').select('questionnaire_id').eq('participant_id', user.id).eq('is_complete', true)
  const completedQIds = new Set(completedResults?.map(r => r.questionnaire_id) ?? [])

  const { data: submittedSociograms } = await supabase.from('sociogram_participants').select('sociogram_id').eq('participant_id', user.id).eq('has_submitted', true)
  const submittedSocIds = new Set(submittedSociograms?.map(s => s.sociogram_id) ?? [])

  const iatIds = (iats ?? []).map((i: any) => i.id)
  const [{ data: completedIatSessions }, { data: completedIatTrials }] = await Promise.all([
    iatIds.length ? supabase.from('iat_session_results').select('iat_id').eq('participant_id', user.id).in('iat_id', iatIds) : { data: [] },
    iatIds.length ? supabase.from('iat_trial_log').select('iat_id').eq('participant_id', user.id).in('iat_id', iatIds).limit(iatIds.length * 10) : { data: [] },
  ])
  const completedIatIds = new Set([
    ...(completedIatSessions ?? []).map((r: any) => r.iat_id),
    ...(completedIatTrials  ?? []).map((r: any) => r.iat_id),
  ])

  // Build per-study data
  const studyMap: Record<string, {
    pendingQ: any[]; pendingSoc: any[]; pendingIat: any[]
    completedQ: any[]; completedSoc: any[]; completedIat: any[]
    totalCount: number; completedCount: number
  }> = {}

  for (const sid of studyIds) {
    const allQ = (questionnaires ?? []).filter((q: any) => q.study_id === sid)
    const allS = (sociograms    ?? []).filter((s: any) => s.study_id === sid)
    const allI = (iats          ?? []).filter((i: any) => i.study_id === sid)
    studyMap[sid] = {
      pendingQ:   allQ.filter((q: any) => !completedQIds.has(q.id)),
      pendingSoc: allS.filter((s: any) => !submittedSocIds.has(s.id)),
      pendingIat: allI.filter((i: any) => !completedIatIds.has(i.id)),
      completedQ: allQ.filter((q: any) => completedQIds.has(q.id)),
      completedSoc:allS.filter((s: any) => submittedSocIds.has(s.id)),
      completedIat:allI.filter((i: any) => completedIatIds.has(i.id)),
      totalCount:     allQ.length + allS.length + allI.length,
      completedCount: allQ.filter((q:any)=>completedQIds.has(q.id)).length +
                      allS.filter((s:any)=>submittedSocIds.has(s.id)).length +
                      allI.filter((i:any)=>completedIatIds.has(i.id)).length,
    }
  }

  const grandTotal   = studyIds.reduce((a, sid) => a + studyMap[sid].totalCount, 0)
  const grandDone    = studyIds.reduce((a, sid) => a + studyMap[sid].completedCount, 0)
  const grandPending = grandTotal - grandDone
  const overallPct   = grandTotal > 0 ? Math.round((grandDone / grandTotal) * 100) : 0
  const allDone      = grandTotal > 0 && grandPending === 0

  const name = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-slide-up">

      {/* ── Hero / Welcome ── */}
      <div className="mb-8 text-center">
        {/* Avatar */}
        <div className="relative inline-block mb-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url} alt=""
              className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {getInitials(profile?.full_name ?? null)}
            </div>
          )}
          {allDone && studyIds.length > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-sm text-xs">🏆</div>
          )}
        </div>

        <h1 className="font-serif text-2xl font-bold text-gray-900">
          {greeting()}{name !== 'there' ? ` ${name}` : ''}
        </h1>

        {/* Grand progress summary */}
        {grandTotal > 0 ? (
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="relative">
              <ProgressRing pct={overallPct} color="#059669" size={64} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-emerald-700">{overallPct}%</span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">
                {grandDone} of {grandTotal} tasks complete
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {allDone
                  ? '🎉 All done — you are awesome!'
                  : `${grandPending} remaining · you got this!`}
              </p>
            </div>
          </div>
        ) : studyIds.length > 0 ? (
          <p className="text-sm text-gray-500 mt-2">No tasks added yet. Check back soon!</p>
        ) : null}
      </div>

      {/* ── No enrolment state ── */}
      {studyIds.length === 0 && (
        <div className="text-center py-16 rounded-3xl border-2 border-dashed border-emerald-200 bg-white/60">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="font-serif text-xl font-semibold text-gray-800 mb-2">Not in any studies yet</p>
          <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
            Your researcher will send you an invitation link. Check your email or ask them directly!
          </p>
        </div>
      )}

      {/* ── Per-study cards ── */}
      <div className="space-y-5">
        {studyIds.map(sid => {
          const study = studyById[sid] as any
          const { pendingQ, pendingSoc, pendingIat, completedQ, completedSoc, completedIat, totalCount, completedCount } = studyMap[sid]
          const pendingCount = pendingQ.length + pendingSoc.length + pendingIat.length
          const isAllDone    = totalCount > 0 && completedCount === totalCount
          const pct          = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
          const researcher   = study?.profiles

          return (
            <div
              key={sid}
              className="rounded-3xl overflow-hidden bg-white/80 backdrop-blur-sm border border-white shadow-sm"
            >
              {/* Study header */}
              <div
                className="px-6 pt-5 pb-4"
                style={{
                  background: isAllDone
                    ? 'linear-gradient(135deg, #D1FAE5, #A7F3D0)'
                    : 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Progress ring */}
                  <div className="relative shrink-0">
                    <ProgressRing
                      pct={pct}
                      color={isAllDone ? '#059669' : (researcher?.researcher_color ?? '#059669')}
                      size={52}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isAllDone
                        ? <span className="text-sm">✅</span>
                        : <span className="text-[10px] font-bold text-emerald-700">{pct}%</span>
                      }
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-serif text-base font-bold text-gray-900 leading-tight">
                      {study?.title ?? 'Study'}
                    </h2>
                    {researcher && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {researcher.avatar_url ? (
                          <img src={researcher.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                            style={{ backgroundColor: researcher.researcher_color ?? '#059669' }}
                          >
                            {getInitials(researcher.full_name)}
                          </div>
                        )}
                        <span className="text-xs text-gray-500">by {researcher.full_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {completedCount}/{totalCount} done
                      </span>
                      {pendingCount > 0 && (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="px-6 py-4 space-y-2.5">

                {/* All done celebration */}
                {isAllDone && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <p className="text-sm font-bold text-amber-900">All done — amazing!</p>
                      <p className="text-xs text-amber-700">Your contributions support meaningful research.</p>
                    </div>
                  </div>
                )}

                {/* Pending questionnaires */}
                {pendingQ.map((q: any) => (
                  <div key={q.id} className="task-card flex items-center justify-between gap-3 p-4 rounded-2xl border border-sky-200 bg-sky-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{q.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {q.validated_scale_name && (
                            <span className="text-[10px] text-sky-600 bg-sky-100 px-1.5 py-px rounded-full font-medium">{q.validated_scale_name}</span>
                          )}
                          {q.estimated_duration_minutes && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />~{q.estimated_duration_minutes} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white rounded-xl border-none gap-1.5">
                      <Link href={`/participant/questionnaire/${q.id}`}>
                        Begin <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                ))}

                {/* Pending sociograms */}
                {pendingSoc.map((s: any) => (
                  <div key={s.id} className="task-card flex items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{s.title}</p>
                        <p className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-px rounded-full font-medium inline-block mt-0.5">Peer nomination</p>
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl border-none gap-1.5">
                      <Link href={`/participant/sociogram/${s.id}`}>
                        Begin <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                ))}

                {/* Pending IATs */}
                {pendingIat.map((iat: any) => (
                  <div key={iat.id} className="task-card flex items-center justify-between gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Timer className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{iat.title}</p>
                        <p className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-px rounded-full font-medium inline-block mt-0.5">⌨️ Needs keyboard</p>
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white rounded-xl border-none gap-1.5">
                      <Link href={`/participant/iat/${iat.id}`}>
                        Begin <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                ))}

                {/* Completed items */}
                {[
                  ...completedQ.map((q: any)   => ({ ...q, _type: 'questionnaire', _icon: <ClipboardList className="w-3.5 h-3.5 text-gray-400" /> })),
                  ...completedSoc.map((s: any) => ({ ...s, _type: 'sociogram',     _icon: <Users className="w-3.5 h-3.5 text-gray-400" />         })),
                  ...completedIat.map((i: any) => ({ ...i, _type: 'iat',           _icon: <Timer className="w-3.5 h-3.5 text-gray-400" />          })),
                ].filter(item => item.study_id === sid).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 px-3 opacity-50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-[12px] text-gray-600 flex-1 truncate line-through">{item.title}</p>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-px rounded-full shrink-0">Done</span>
                  </div>
                ))}

                {totalCount === 0 && (
                  <div className="text-center py-6">
                    <Lock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 italic">No tasks added yet — check back soon</p>
                  </div>
                )}
              </div>

              {/* Leave study */}
              <div className="px-6 pb-5 pt-2 border-t border-gray-100">
                <LeaveStudyButton studyId={sid} studyTitle={study?.title ?? 'this study'} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Profile link */}
      {studyIds.length > 0 && (
        <div className="mt-8 text-center">
          <Link href="/participant/profile"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            <User className="w-4 h-4" />
            Update my profile
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
