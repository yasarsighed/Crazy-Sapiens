import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ClipboardList, CheckCircle2, Clock, Users, Timer,
  FlaskConical, User, ArrowRight, Lock, Keyboard,
} from 'lucide-react'
import { LeaveStudyButton } from '@/components/leave-study-button'
import { PendingTasksReminder } from '@/components/pending-tasks-reminder'

// ── Instrument-type theming (v6 brand palette) ──────────────────────────────
const TYPE_META = {
  questionnaire: { color: '#C6A8F0', Icon: ClipboardList, kind: 'Questionnaire',   est: null as string | null },
  sociogram:     { color: '#86C99A', Icon: Users,         kind: 'Peer nomination', est: '~3 min' },
  iat:           { color: '#F0A65C', Icon: Timer,         kind: 'Reaction task',   est: '~10 min' },
} as const

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

function ProgressRing({ pct, color = '#CE2029', size = 56 }: { pct: number; color?: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={dash}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </svg>
  )
}

// A single pending task row, themed by instrument type.
function TaskRow({
  href, title, color, Icon, kind, meta,
}: {
  href: string
  title: string
  color: string
  Icon: typeof ClipboardList
  kind: string
  meta?: React.ReactNode
}) {
  return (
    <div
      className="task-card flex items-center justify-between gap-3 p-4 rounded-2xl border"
      style={{
        borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
        background: `color-mix(in srgb, ${color} 7%, var(--card))`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 18%, var(--card))` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-xs px-1.5 py-px rounded-full font-medium"
              style={{ color, background: `color-mix(in srgb, ${color} 14%, var(--card))` }}
            >
              {kind}
            </span>
            {meta}
          </div>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className="shrink-0 text-white rounded-xl border-none gap-1.5 hover:opacity-90"
        style={{ background: color }}
      >
        <Link href={href}>
          Begin <ArrowRight className="w-3 h-3" />
        </Link>
      </Button>
    </div>
  )
}

export default async function ParticipantDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Phase 1: identity + enrollments (both keyed on user.id) run together ──
  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('study_enrollments').select('study_id, status, consented_at').eq('participant_id', user.id).eq('status', 'active'),
  ])

  const studyIds = enrollments?.map(e => e.study_id) ?? []

  // ── Phase 2: study details, all instrument types, and the participant's
  // questionnaire/sociogram completions — none depend on each other, so fire
  // them in a single parallel batch instead of sequential round-trips. ──
  const empty = Promise.resolve({ data: [] as any[] })
  const [
    { data: studyDetails },
    { data: questionnaires },
    { data: sociograms },
    { data: iats },
    { data: completedResults },
    { data: submittedSociograms },
  ] = await Promise.all([
    studyIds.length
      ? supabase.from('studies').select('id, title, description, created_by, profiles!studies_created_by_fkey(full_name, researcher_color, avatar_url)').in('id', studyIds)
      : empty,
    studyIds.length
      ? supabase.from('questionnaire_instruments').select('id,study_id,title,estimated_duration_minutes,validated_scale_name,status').in('study_id', studyIds).eq('status', 'active')
      : empty,
    studyIds.length
      ? supabase.from('sociogram_instruments').select('id,study_id,title,status').in('study_id', studyIds).eq('status', 'active')
      : empty,
    studyIds.length
      ? supabase.from('iat_instruments').select('id,study_id,title').in('study_id', studyIds)
      : empty,
    supabase.from('questionnaire_scored_results').select('questionnaire_id').eq('participant_id', user.id).eq('is_complete', true),
    supabase.from('sociogram_participants').select('sociogram_id').eq('participant_id', user.id).eq('has_submitted', true),
  ])

  const studyById = Object.fromEntries((studyDetails ?? []).map((s: any) => [s.id, s]))
  const completedQIds = new Set(completedResults?.map((r: any) => r.questionnaire_id) ?? [])
  const submittedSocIds = new Set(submittedSociograms?.map((s: any) => s.sociogram_id) ?? [])

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

  // Rough total time remaining across every pending task — questionnaires use
  // their own estimate when set, sociograms/IATs use the same flat estimate
  // shown per-task elsewhere on this page (3 min / 5 min).
  const minutesRemaining = studyIds.reduce((total, sid) => {
    const m = studyMap[sid]
    const qMin = m.pendingQ.reduce((a: number, q: any) => a + (q.estimated_duration_minutes ?? 3), 0)
    return total + qMin + m.pendingSoc.length * 3 + m.pendingIat.length * 10
  }, 0)

  // First pending task across all studies — powers the "do this next" reminder.
  let nextTask: { href: string; title: string; color: string } | null = null
  for (const sid of studyIds) {
    const m = studyMap[sid]
    if (m.pendingQ[0])      { nextTask = { href: `/participant/questionnaire/${m.pendingQ[0].id}`, title: m.pendingQ[0].title, color: TYPE_META.questionnaire.color }; break }
    if (m.pendingSoc[0])    { nextTask = { href: `/participant/sociogram/${m.pendingSoc[0].id}`,    title: m.pendingSoc[0].title, color: TYPE_META.sociogram.color }; break }
    if (m.pendingIat[0])    { nextTask = { href: `/participant/iat/${m.pendingIat[0].id}`,          title: m.pendingIat[0].title, color: TYPE_META.iat.color }; break }
  }

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
              className="w-16 h-16 rounded-2xl object-cover border-4 border-card shadow-lg"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #CE2029, #EC8FC8)' }}
            >
              {getInitials(profile?.full_name ?? null)}
            </div>
          )}
          {allDone && studyIds.length > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs" style={{ background: '#D09028' }}>🏆</div>
          )}
        </div>

        <h1 className="font-serif text-2xl font-bold text-foreground">
          {greeting()}{name !== 'there' ? ` ${name}` : ''}
        </h1>

        {/* Grand progress summary */}
        {grandTotal > 0 ? (
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="relative">
              <ProgressRing pct={overallPct} color="#CE2029" size={64} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{overallPct}%</span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {grandDone} of {grandTotal} tasks complete
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {allDone
                  ? '🎉 All done — you are awesome!'
                  : `${grandPending} remaining · you got this!`}
              </p>
              {!allDone && minutesRemaining > 0 && (
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  ~{minutesRemaining} min left in total
                </p>
              )}
            </div>
          </div>
        ) : studyIds.length > 0 ? (
          <p className="text-sm text-muted-foreground mt-2">No tasks added yet. Check back soon!</p>
        ) : null}
      </div>

      {/* ── Reminder: next pending task ── */}
      {nextTask && grandPending > 0 && (
        <PendingTasksReminder
          count={grandPending}
          nextHref={nextTask.href}
          nextTitle={nextTask.title}
          nextColor={nextTask.color}
        />
      )}

      {/* ── No enrolment state ── */}
      {studyIds.length === 0 && (
        <div className="text-center py-16 rounded-3xl border-2 border-dashed border-border bg-card/60">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-8 h-8 text-primary" />
          </div>
          <p className="font-serif text-xl font-semibold text-foreground mb-2">Not in any studies yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
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
          const accent       = researcher?.researcher_color ?? '#CE2029'

          return (
            <div
              key={sid}
              className="rounded-3xl overflow-hidden bg-card/80 backdrop-blur-sm border border-border shadow-sm"
            >
              {/* Study header */}
              <div
                className="px-6 pt-5 pb-4"
                style={{
                  background: isAllDone
                    ? 'color-mix(in srgb, #86C99A 14%, var(--card))'
                    : `color-mix(in srgb, ${accent} 9%, var(--card))`,
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Progress ring */}
                  <div className="relative shrink-0">
                    <ProgressRing
                      pct={pct}
                      color={isAllDone ? '#86C99A' : accent}
                      size={52}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isAllDone
                        ? <span className="text-sm">✅</span>
                        : <span className="text-xs font-bold text-foreground">{pct}%</span>
                      }
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-serif text-base font-bold text-foreground leading-tight">
                      {study?.title ?? 'Study'}
                    </h2>
                    {researcher && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {researcher.avatar_url ? (
                          <img src={researcher.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ backgroundColor: accent }}
                          >
                            {getInitials(researcher.full_name)}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">by {researcher.full_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground bg-secondary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" style={{ color: '#86C99A' }} />
                        {completedCount}/{totalCount} done
                      </span>
                      {pendingCount > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: '#F0A65C', background: 'color-mix(in srgb, #F0A65C 12%, var(--card))' }}>
                          <Clock className="w-3 h-3" />
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
                  <div className="flex items-center gap-3 p-4 rounded-2xl border" style={{ background: 'color-mix(in srgb, #86C99A 10%, var(--card))', borderColor: 'color-mix(in srgb, #86C99A 30%, transparent)' }}>
                    <span className="text-2xl">🏆</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">All done — amazing!</p>
                      <p className="text-xs text-muted-foreground">Your contributions support meaningful research.</p>
                    </div>
                  </div>
                )}

                {/* Pending questionnaires */}
                {pendingQ.map((q: any) => (
                  <TaskRow
                    key={q.id}
                    href={`/participant/questionnaire/${q.id}`}
                    title={q.title}
                    color={TYPE_META.questionnaire.color}
                    Icon={TYPE_META.questionnaire.Icon}
                    kind={q.validated_scale_name || TYPE_META.questionnaire.kind}
                    meta={q.estimated_duration_minutes ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />~{q.estimated_duration_minutes} min
                      </span>
                    ) : null}
                  />
                ))}

                {/* Pending sociograms */}
                {pendingSoc.map((s: any) => (
                  <TaskRow
                    key={s.id}
                    href={`/participant/sociogram/${s.id}`}
                    title={s.title}
                    color={TYPE_META.sociogram.color}
                    Icon={TYPE_META.sociogram.Icon}
                    kind={TYPE_META.sociogram.kind}
                    meta={
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{TYPE_META.sociogram.est}
                      </span>
                    }
                  />
                ))}

                {/* Pending IATs */}
                {pendingIat.map((iat: any) => (
                  <TaskRow
                    key={iat.id}
                    href={`/participant/iat/${iat.id}`}
                    title={iat.title}
                    color={TYPE_META.iat.color}
                    Icon={TYPE_META.iat.Icon}
                    kind={TYPE_META.iat.kind}
                    meta={
                      <>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{TYPE_META.iat.est}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Keyboard className="w-2.5 h-2.5" />keyboard recommended
                        </span>
                      </>
                    }
                  />
                ))}

                {/* Completed items */}
                {[
                  ...completedQ.map((q: any)   => ({ ...q, _type: 'questionnaire' })),
                  ...completedSoc.map((s: any) => ({ ...s, _type: 'sociogram'     })),
                  ...completedIat.map((i: any) => ({ ...i, _type: 'iat'           })),
                ].filter(item => item.study_id === sid).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 px-3 opacity-60">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#86C99A' }} />
                    <p className="text-sm text-muted-foreground flex-1 truncate line-through">{item.title}</p>
                    <span className="text-xs font-semibold px-2 py-px rounded-full shrink-0" style={{ color: '#86C99A', background: 'color-mix(in srgb, #86C99A 12%, var(--card))' }}>Done</span>
                  </div>
                ))}

                {totalCount === 0 && (
                  <div className="text-center py-6">
                    <Lock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground italic">No tasks added yet — check back soon</p>
                  </div>
                )}
              </div>

              {/* Leave study */}
              <div className="px-6 pb-5 pt-2 border-t border-border">
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
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
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
