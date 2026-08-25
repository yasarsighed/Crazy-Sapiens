import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StudyCard } from '@/components/study-card'
import { ClinicalAlert } from '@/components/clinical-alert'
import { EmptyState } from '@/components/empty-state'
import { Mascot } from '@/components/mascot'
import { DashboardCustomizer } from '@/components/dashboard-customizer'
import { RandomGreeting } from '@/components/random-greeting'
import { StatusBadge } from '@/components/status-badge'
import {
  Plus, ExternalLink, Library, ClipboardList, ShieldAlert,
  Sparkles, TrendingUp, Users, FlaskConical, Bell,
  CheckCircle2, AlertTriangle, Activity, Zap, ArrowRight,
  Brain, Clock, BookOpen, Mail,
} from 'lucide-react'
import type { Profile, Study, ClinicalAlert as ClinicalAlertType } from '@/types/database'

function firstName(full: string | null) {
  return full?.split(' ')[0] || 'Researcher'
}

// ── Quick action items (icon colour; tile is ink) ──
const QUICK_ACTIONS = [
  { label: 'New Study',         href: '/studies/new',   icon: FlaskConical, color: '#EBC15C' },
  { label: 'Scale Library',    href: '/scale-library', icon: BookOpen,     color: '#C6A8F0' },
  { label: 'View Participants', href: '/participants',  icon: Users,        color: '#86C99A' },
  { label: 'Audit Log',        href: '/audit-log',     icon: ClipboardList,color: '#F0A65C' },
]

// ── Activity icon / colour helpers ──
function activityDot(type: string) {
  if (type === 'enrollment' || type === 'enroll') return 'bg-[#86C99A]'
  if (type === 'alert')      return 'bg-[#EBC15C]'
  if (type === 'completion') return 'bg-[#F0A65C]'
  if (type === 'submit')     return 'bg-[#C6A8F0]'
  return 'bg-[#F0A65C]'
}

function activityLabel(row: { action_type: string; entity_type: string }) {
  const action = row.action_type.replace(/_/g, ' ')
  const entity = row.entity_type.replace(/_/g, ' ')
  return `${action} · ${entity}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  // ── Phase 1: everything scoped by role/user (independent of study ids) ──
  // Build role-conditional query filters up front, then fire them all together.
  const studiesQ = isAdmin
    ? supabase.from('studies').select('*').order('created_at', { ascending: false }).limit(6)
    : supabase.from('studies').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(6)
  const activeStudiesQ = isAdmin
    ? supabase.from('studies').select('*', { count: 'exact', head: true }).eq('status', 'active')
    : supabase.from('studies').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('created_by', user.id)
  const recentActivityQ = isAdmin
    ? supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10)
    : supabase.from('activity_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
  // Full (unlimited) set of study ids this viewer owns — used to scope clinical
  // alerts so a non-admin never sees another researcher's participants' alerts.
  // The `studies` query above is capped at 6 for the dashboard table, which is
  // too narrow to safely scope alerts against.
  const ownedStudyIdsQ = isAdmin
    ? Promise.resolve({ data: [] as { id: string }[] })
    : supabase.from('studies').select('id').eq('created_by', user.id)

  const [
    { data: studies },
    { count: activeStudiesCount },
    { data: recentActivity },
    { data: peers },
    { data: ownedStudyIds },
  ] = await Promise.all([
    studiesQ,
    activeStudiesQ,
    recentActivityQ,
    supabase.from('profiles').select('id,full_name,researcher_color,role').in('role', ['researcher','supervisor']).neq('id', user.id).limit(6),
    ownedStudyIdsQ,
  ])

  const studyIds = studies?.map(s => s.id) || []

  // Clinical alerts, scoped to the viewer's own studies unless admin.
  const alertScopeIds = isAdmin ? null : (ownedStudyIds ?? []).map(s => s.id)
  const alertsBaseQ = supabase.from('clinical_alerts_log').select('*').eq('acknowledged', false)
  const alertsCountBaseQ = supabase.from('clinical_alerts_log').select('*', { count: 'exact', head: true }).eq('acknowledged', false)
  const [{ data: clinicalAlerts }, { count: alertsCount }] = isAdmin
    ? await Promise.all([
        alertsBaseQ.order('created_at', { ascending: false }).limit(5),
        alertsCountBaseQ,
      ])
    : alertScopeIds!.length
      ? await Promise.all([
          alertsBaseQ.in('study_id', alertScopeIds!).order('created_at', { ascending: false }).limit(5),
          alertsCountBaseQ.in('study_id', alertScopeIds!),
        ])
      : [{ data: [] as ClinicalAlertType[] }, { count: 0 }]

  // Resolve participant names + study titles for the alert cards so they're
  // actionable instead of showing a raw truncated participant UUID.
  const alertParticipantIds = [...new Set((clinicalAlerts ?? []).map(a => a.participant_id))]
  const alertStudyIds = [...new Set((clinicalAlerts ?? []).map((a: any) => a.study_id).filter(Boolean))]
  const [{ data: alertProfiles }, { data: alertStudies }] = await Promise.all([
    alertParticipantIds.length ? supabase.from('profiles').select('id, full_name').in('id', alertParticipantIds) : Promise.resolve({ data: [] as any[] }),
    alertStudyIds.length ? supabase.from('studies').select('id, title').in('id', alertStudyIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const alertProfileMap = Object.fromEntries((alertProfiles ?? []).map((p: any) => [p.id, p.full_name as string | null]))
  const alertStudyMap = Object.fromEntries((alertStudies ?? []).map((s: any) => [s.id, s.title as string]))

  // ── Phase 2: study-scoped instruments + participant count (need studyIds) ──
  const empty = Promise.resolve({ data: [] as { id: string; study_id: string }[] })
  const [
    { data: qInstrs },
    { data: socInstrs },
    { data: iatInstrs },
    { count: totalParticipants },
  ] = await Promise.all([
    studyIds.length ? supabase.from('questionnaire_instruments').select('id,study_id').in('study_id', studyIds) : empty,
    studyIds.length ? supabase.from('sociogram_instruments').select('id,study_id').in('study_id', studyIds)     : empty,
    studyIds.length ? supabase.from('iat_instruments').select('id,study_id').in('study_id', studyIds)           : empty,
    studyIds.length ? supabase.from('study_enrollments').select('*', { count: 'exact', head: true }).in('study_id', studyIds) : Promise.resolve({ count: 0 }),
  ])

  const instrumentsByStudy: Record<string, Array<{ type: 'questionnaire'|'iat'|'sociogram' }>> = {}
  for (const i of (qInstrs   || [])) { (instrumentsByStudy[i.study_id] ??= []).push({ type: 'questionnaire' }) }
  for (const i of (socInstrs || [])) { (instrumentsByStudy[i.study_id] ??= []).push({ type: 'sociogram'     }) }
  for (const i of (iatInstrs || [])) { (instrumentsByStudy[i.study_id] ??= []).push({ type: 'iat'           }) }

  // ── Phase 3: completed responses (needs questionnaire ids from phase 2) ──
  const qIds = (qInstrs || []).map(q => q.id)
  const { count: responsesCount } = qIds.length
    ? await supabase.from('questionnaire_scored_results').select('*', { count: 'exact', head: true }).in('questionnaire_id', qIds).eq('is_complete', true)
    : { count: 0 }

  // Admin breakdown
  let researcherBreakdown: Array<{ profile: Profile; studyCount: number; latestStudy: string|null }> = []
  if (isAdmin) {
    const [{ data: allResearchers }, { data: allStudies }] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['researcher','admin','supervisor']),
      supabase.from('studies').select('id,title,created_by,created_at').order('created_at', { ascending: false }),
    ])
    const byR = new Map<string, { count: number; latest: string|null }>()
    for (const s of allStudies ?? []) {
      const cur = byR.get(s.created_by) ?? { count: 0, latest: null }
      cur.count++
      if (!cur.latest) cur.latest = s.title
      byR.set(s.created_by, cur)
    }
    researcherBreakdown = (allResearchers ?? [])
      .map((r: Profile) => ({ profile: r, studyCount: byR.get(r.id)?.count ?? 0, latestStudy: byR.get(r.id)?.latest ?? null }))
      .filter(x => x.studyCount > 0)
      .sort((a, b) => b.studyCount - a.studyCount)
  }

  const name   = firstName(profile?.full_name)
  const researcherColor = profile?.researcher_color || '#CE2029'

  // ── Per-researcher personalization ──
  const prefs = (profile?.dashboard_prefs as { hidden?: string[]; greeting?: string | null; bgColor?: string | null } | null) ?? {}
  const hidden = new Set<string>(prefs.hidden ?? [])
  const show = (key: string) => !hidden.has(key)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Welcome banner ── */}
      <div
        className="px-8 pt-8 pb-6 relative overflow-hidden"
        style={{
          background: isAdmin
            ? 'color-mix(in srgb, #A5171F 12%, var(--background))'
            : `color-mix(in srgb, ${researcherColor} 10%, var(--background))`,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Decorative dots */}
        <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

        <div className="relative flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <Mascot size="md" animate />
            </div>
            <div>
              <RandomGreeting
                name={name}
                customGreeting={prefs.greeting}
                className="font-serif text-2xl lg:text-3xl font-semibold leading-tight text-foreground"
              />
              {isAdmin && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3" />
                  Admin view — all studies visible across platform
                </p>
              )}
              {!isAdmin && (
                <p className={`text-sm mt-1 flex items-center gap-1.5`} style={{ color: `color-mix(in srgb, ${researcherColor} 60%, var(--foreground))` }}>
                  <Activity className="w-3.5 h-3.5" />
                  {activeStudiesCount ?? 0} active stud{(activeStudiesCount ?? 0) === 1 ? 'y' : 'ies'} · {totalParticipants ?? 0} participants
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <DashboardCustomizer
                userId={profile.id}
                initialColor={researcherColor}
                initialHidden={prefs.hidden ?? []}
                initialGreeting={prefs.greeting ?? null}
                initialBgColor={prefs.bgColor ?? null}
              />
            )}
            {alertsCount ? (
              <Link href="/audit-log?type=alert">
                <Button variant="destructive" size="sm" className="gap-1.5 animate-pulse">
                  <Bell className="w-3.5 h-3.5" />
                  {alertsCount} Alert{alertsCount > 1 ? 's' : ''}
                </Button>
              </Link>
            ) : null}
            {!isAdmin && (
              <Button asChild size="sm" className="gap-1.5 shadow-md" style={{ backgroundColor: researcherColor, color: '#fff', border: 'none' }}>
                <Link href="/studies/new">
                  <Plus className="w-3.5 h-3.5" />
                  New Study
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ── Stat strip — instrument panel ── */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { label: isAdmin ? 'Platform Studies' : 'Active Studies', value: activeStudiesCount ?? 0, icon: FlaskConical, color: '#EBC15C', sub: 'running now', alert: false },
            { label: 'Participants',    value: totalParticipants  ?? 0, icon: Users,         color: '#86C99A', sub: 'enrolled',   alert: false },
            { label: 'Responses',       value: responsesCount     ?? 0, icon: CheckCircle2,  color: '#C6A8F0', sub: 'completed',  alert: false },
            { label: 'Clinical Alerts', value: alertsCount        ?? 0, icon: AlertTriangle, color: '#EBC15C', sub: alertsCount ? 'needs review' : 'all clear', alert: !!alertsCount },
          ].map(stat => (
            <div key={stat.label} className="rounded-md border border-border px-4 py-3.5" style={{ background: stat.alert ? '#EBC15C' : 'var(--card)' }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.11em] uppercase" style={{ color: stat.alert ? '#5C0912' : 'var(--muted-foreground)' }}>
                  {stat.label}
                </span>
                <stat.icon className="w-4 h-4" style={{ color: stat.alert ? '#8F0E1F' : stat.color }} />
              </div>
              <p
                className="font-mono text-[30px] font-medium tabular-nums leading-none mt-3"
                style={{ color: stat.alert ? '#8F0E1F' : 'var(--foreground)' }}
              >
                {stat.value.toLocaleString()}
              </p>
              <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: stat.alert ? '#5C0912' : 'var(--muted-foreground)' }}>
                {stat.alert && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#8F0E1F' }} />}
                {stat.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6">

        {/* ── Quick actions ── */}
        {show('quickActions') && (
        <div className="mb-6">
          <p className="section-label mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(action => (
              <Link key={action.href} href={action.href}>
                <div className="flex items-center gap-3 p-3.5 rounded-md border border-border bg-card hover:border-foreground/40 transition-all duration-150 group cursor-pointer">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-[#180D0C] group-hover:scale-105 transition-transform">
                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground leading-tight">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* Left column */}
          <div className="space-y-6">

            {/* Studies — table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-serif text-base font-semibold flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" style={{ color: researcherColor }} />
                  {isAdmin ? 'All Studies' : 'Your Studies'}
                </h3>
                <Link href="/studies" className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {studies?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Study', 'Instruments', 'Status', 'Completion'].map(h => (
                          <th key={h} className="text-left font-mono text-[9.5px] tracking-[0.08em] uppercase text-muted-foreground font-medium px-4 py-2.5 border-b border-border">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {studies.map((study: Study) => {
                        const insts = instrumentsByStudy[study.id] || []
                        const counts: Record<'questionnaire'|'sociogram'|'iat', number> = { questionnaire: 0, sociogram: 0, iat: 0 }
                        for (const i of insts) counts[i.type]++
                        const typeMeta = [
                          { k: 'questionnaire' as const, label: 'Quest', color: '#C6A8F0' },
                          { k: 'sociogram'     as const, label: 'Socio', color: '#86C99A' },
                          { k: 'iat'           as const, label: 'IAT',   color: '#F0A65C' },
                        ]
                        const pct = Math.round((study as any).completion_percentage ?? 0)
                        return (
                          <tr key={study.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 align-middle">
                              <Link href={`/studies/${study.id}`} className="font-semibold text-foreground hover:text-primary">{study.title}</Link>
                              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                                {new Date(study.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex gap-1 flex-wrap">
                                {typeMeta.filter(t => counts[t.k] > 0).map(t => (
                                  // These pastel instrument colors (lavender/mint/orange) were
                                  // tuned for legibility on the fixed dark-red background — used
                                  // directly as text color, they measure as low as 1.7:1 contrast
                                  // against a light custom background. A background tint doesn't
                                  // fix that (the text color itself is the problem, not what's
                                  // behind it), so identity now comes from the border + a small
                                  // dot instead, and the text uses the guaranteed-safe foreground
                                  // token — same pattern already used for relationship-type badges
                                  // elsewhere in the app.
                                  <span key={t.k} className="font-mono text-[10px] pl-1 pr-1.5 py-0.5 rounded border tabular-nums flex items-center gap-1" style={{ color: 'var(--card-foreground)', borderColor: `color-mix(in srgb, ${t.color} 40%, transparent)` }}>
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                                    {counts[t.k]}&nbsp;{t.label}
                                  </span>
                                ))}
                                {insts.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-middle"><StatusBadge status={study.status} /></td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
                                </div>
                                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <FlaskConical className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="font-serif text-base text-foreground mb-1">No studies yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Create your first study to get started.</p>
                  <Button asChild size="sm">
                    <Link href="/studies/new"><Plus className="w-3.5 h-3.5 mr-1.5" />Create your first study</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Admin: researcher breakdown */}
            {isAdmin && researcherBreakdown.length > 0 && (
              <Card className="border-border overflow-hidden">
                <CardHeader className="pb-3 border-b border-border bg-muted/30">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" /> Researcher Activity
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Who&apos;s doing what</p>
                </CardHeader>
                <CardContent className="p-3 space-y-1">
                  {researcherBreakdown.map(({ profile: r, studyCount, latestStudy }) => (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: r.researcher_color || '#CE2029' }}
                      >
                        {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{r.full_name || r.email}</p>
                        {latestStudy && <p className="text-[11px] text-muted-foreground truncate">Latest: {latestStudy}</p>}
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums text-[11px]">
                        {studyCount} {studyCount === 1 ? 'study' : 'studies'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Platform researchers */}
            {show('researchers') && (
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: '#C6A8F0' }} /> Platform Researchers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {peers?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {peers.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ backgroundColor: r.researcher_color || '#CE2029' }}
                        >
                          {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                        </div>
                        <span className="text-[13px] font-medium">{r.full_name?.split(' ')[0] || 'Researcher'}</span>
                        <span className="text-[11px] text-muted-foreground capitalize opacity-70">{r.role}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No other researchers yet." subtitle="Invite colleagues to collaborate — or to share the blame when the p-value doesn't cooperate." />
                )}
              </CardContent>
            </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Clinical alerts */}
            {(clinicalAlerts?.length ?? 0) > 0 && (
              <Card className="overflow-hidden border-[color:var(--brand-gold)]/50" style={{ borderColor: 'color-mix(in srgb, #EBC15C 50%, transparent)' }}>
                <CardHeader className="pb-2 border-b" style={{ background: '#180D0C', borderColor: 'color-mix(in srgb, #EBC15C 30%, transparent)' }}>
                  <CardTitle className="font-serif text-base flex items-center gap-2" style={{ color: '#EBC15C' }}>
                    <AlertTriangle className="w-4 h-4" /> Clinical Alerts
                  </CardTitle>
                  <p className="text-[11px] mt-1" style={{ color: 'color-mix(in srgb, #EBC15C 80%, transparent)' }}>
                    Please review promptly.
                  </p>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {clinicalAlerts!.map((alert: any) => {
                    // The live clinical_alerts_log table has no severity/message
                    // columns at all (confirmed against a real row 2026-08-19) —
                    // reading alert.severity/alert.message here always produced
                    // undefined, so every alert card rendered blank text with
                    // generic "low" styling regardless of true severity. The
                    // real signal is alert_level (free text: 'critical' | 'high'
                    // | 'moderate' seen in practice) and trigger_description.
                    const severity =
                      alert.alert_level === 'critical' || alert.alert_level === 'high' ? 'critical'
                      : alert.alert_level === 'moderate' ? 'moderate'
                      : 'low'
                    return (
                      <ClinicalAlert
                        key={alert.id}
                        id={alert.id}
                        severity={severity}
                        message={alert.trigger_description ?? alert.scale_name ?? 'Clinical alert'}
                        participantId={alert.participant_id}
                        participantName={alertProfileMap[alert.participant_id]}
                        studyTitle={alertStudyMap[alert.study_id]}
                        createdAt={alert.created_at}
                      />
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* Activity feed */}
            {show('activity') && (
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Live Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {recentActivity?.length ? (
                  <div className="space-y-2">
                    {recentActivity.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-2.5 py-1.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activityDot(a.action_type)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground truncate capitalize">{activityLabel(a)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No activity yet." subtitle="The calm before the data storm." />
                )}
              </CardContent>
            </Card>
            )}

            {/* Resources */}
            {show('resources') && (
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: '#EBC15C' }} /> Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                {[
                  { href: '/scale-library', icon: Library,     label: 'Browse Scale Library',    color: '#C6A8F0' },
                  { href: '/audit-log',     icon: ClipboardList,label: 'View Audit Log',          color: '#F0A65C' },
                  { href: '/participants',  icon: Mail,          label: 'Manage Participants',     color: '#86C99A' },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/70 transition-colors group"
                  >
                    <link.icon className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" style={{ color: link.color }} />
                    <span className="text-sm font-medium text-foreground">{link.label}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
