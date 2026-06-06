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
import {
  Plus, ExternalLink, Library, ClipboardList, ShieldAlert,
  Sparkles, TrendingUp, Users, FlaskConical, Bell,
  CheckCircle2, AlertTriangle, Activity, Zap, ArrowRight,
  Brain, Clock, BookOpen, Mail,
} from 'lucide-react'
import type { Profile, Study, ClinicalAlert as ClinicalAlertType } from '@/types/database'

// ── Greetings with personality ──
const GREETINGS = [
  (n: string) => `The data won't collect itself, ${n}. 🔬`,
  (n: string) => `Your participants are waiting, ${n}. Probably. 👀`,
  (n: string) => `Science o'clock, ${n}. Let's go. ⚡`,
  (n: string) => `Good to see you, ${n}. Your studies missed you. 🧪`,
  (n: string) => `Ready to make history, ${n}? Or at least data. 📊`,
  (n: string) => `${n}, your hypotheses aren't going to test themselves. 🤓`,
]

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const greetIdx = Math.floor(Math.random() * GREETINGS.length)
  const base = GREETINGS[greetIdx](name)
  if (hour < 5  || hour >= 17) return base.replace("Science o'clock", "Evening science")
  if (hour >= 12) return base.replace("Science o'clock", "Afternoon science")
  return base
}

function firstName(full: string | null) {
  return full?.split(' ')[0] || 'Researcher'
}

// ── Quick action items ──
const QUICK_ACTIONS = [
  { label: 'New Study',        href: '/studies/new',   icon: FlaskConical, color: 'bg-violet-500' },
  { label: 'Scale Library',   href: '/scale-library', icon: BookOpen,     color: 'bg-sky-500'    },
  { label: 'View Participants',href: '/participants',  icon: Users,        color: 'bg-emerald-500'},
  { label: 'Audit Log',       href: '/audit-log',     icon: ClipboardList,color: 'bg-amber-500'  },
]

// ── Activity icon / colour helpers ──
function activityDot(type: string) {
  if (type === 'enrollment' || type === 'enroll') return 'bg-emerald-400'
  if (type === 'alert')      return 'bg-red-400'
  if (type === 'completion') return 'bg-violet-400'
  if (type === 'submit')     return 'bg-sky-400'
  return 'bg-amber-400'
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

  // Studies
  let studiesQ = supabase.from('studies').select('*').order('created_at', { ascending: false }).limit(6)
  if (!isAdmin) studiesQ = studiesQ.eq('created_by', user.id)
  const { data: studies } = await studiesQ
  const studyIds = studies?.map(s => s.id) || []

  // Instruments
  const [{ data: qInstrs }, { data: socInstrs }, { data: iatInstrs }] = await Promise.all([
    studyIds.length ? supabase.from('questionnaire_instruments').select('id,study_id').in('study_id', studyIds) : { data: [] as { id:string;study_id:string }[] },
    studyIds.length ? supabase.from('sociogram_instruments').select('id,study_id').in('study_id', studyIds)     : { data: [] as { id:string;study_id:string }[] },
    studyIds.length ? supabase.from('iat_instruments').select('id,study_id').in('study_id', studyIds)           : { data: [] as { id:string;study_id:string }[] },
  ])

  const instrumentsByStudy: Record<string, Array<{ type: 'questionnaire'|'iat'|'sociogram' }>> = {}
  for (const i of (qInstrs   || [])) { (instrumentsByStudy[i.study_id] ??= []).push({ type: 'questionnaire' }) }
  for (const i of (socInstrs || [])) { (instrumentsByStudy[i.study_id] ??= []).push({ type: 'sociogram'     }) }
  for (const i of (iatInstrs || [])) { (instrumentsByStudy[i.study_id] ??= []).push({ type: 'iat'           }) }

  // Alerts
  const { data: clinicalAlerts } = await supabase
    .from('clinical_alerts_log').select('*').eq('acknowledged', false)
    .order('created_at', { ascending: false }).limit(5)

  // Stats
  let activeQ = supabase.from('studies').select('*', { count: 'exact', head: true }).eq('status', 'active')
  if (!isAdmin) activeQ = activeQ.eq('created_by', user.id)
  const { count: activeStudiesCount } = await activeQ

  const { count: totalParticipants } = studyIds.length
    ? await supabase.from('study_enrollments').select('*', { count: 'exact', head: true }).in('study_id', studyIds)
    : { count: 0 }

  const qIds = (qInstrs || []).map(q => q.id)
  const { count: responsesCount } = qIds.length
    ? await supabase.from('questionnaire_scored_results').select('*', { count: 'exact', head: true }).in('questionnaire_id', qIds).eq('is_complete', true)
    : { count: 0 }

  const { count: alertsCount } = await supabase.from('clinical_alerts_log')
    .select('*', { count: 'exact', head: true }).eq('acknowledged', false)

  // Activity
  const activityQ = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10)
  const { data: recentActivity } = isAdmin ? await activityQ : await activityQ.eq('user_id', user.id)

  // Other researchers
  const { data: peers } = await supabase
    .from('profiles').select('id,full_name,researcher_color,role').in('role', ['researcher','supervisor']).neq('id', user.id).limit(6)

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
  const researcherColor = profile?.researcher_color || '#6D28D9'

  return (
    <div className="min-h-screen bg-background">

      {/* ── Welcome banner ── */}
      <div
        className="px-8 pt-8 pb-6 relative overflow-hidden"
        style={{
          background: isAdmin
            ? 'linear-gradient(135deg, #0F0F1A 0%, #1E1B4B 100%)'
            : `linear-gradient(135deg, color-mix(in srgb, ${researcherColor} 12%, #FAFAF8), color-mix(in srgb, ${researcherColor} 5%, #FAFAF8))`,
        }}
      >
        {/* Decorative dots */}
        <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

        <div className="relative flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <Mascot size="md" bounce />
            </div>
            <div>
              <h1
                className={`font-serif text-2xl lg:text-3xl font-semibold leading-tight ${isAdmin ? 'text-white' : 'text-foreground'}`}
              >
                {getGreeting(name)}
              </h1>
              {isAdmin && (
                <p className="text-xs text-white/60 mt-1 flex items-center gap-1.5">
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
            {alertsCount ? (
              <Link href="/admin/requests">
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

        {/* ── Stat strip ── */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { label: isAdmin ? 'Platform Studies' : 'Active Studies', value: activeStudiesCount ?? 0, icon: FlaskConical, color: researcherColor, sub: 'running now' },
            { label: 'Participants',    value: totalParticipants  ?? 0, icon: Users,         color: '#0EA5E9', sub: 'enrolled'     },
            { label: 'Responses',       value: responsesCount     ?? 0, icon: CheckCircle2,  color: '#10B981', sub: 'completed'    },
            { label: 'Clinical Alerts', value: alertsCount        ?? 0, icon: AlertTriangle, color: alertsCount ? '#DC2626' : '#6B6B80', sub: alertsCount ? '⚠️ needs attention' : 'all clear 🎉' },
          ].map(stat => (
            <div
              key={stat.label}
              className={`rounded-2xl border p-4 bg-white/80 backdrop-blur-sm ${isAdmin ? 'border-white/10 bg-white/5 text-white' : 'border-border'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-semibold tracking-wide ${isAdmin ? 'text-white/60' : 'text-muted-foreground'}`}>
                  {stat.label.toUpperCase()}
                </span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="font-serif text-3xl font-bold tabular-nums animate-count-up" style={{ color: stat.color }}>
                {stat.value.toLocaleString()}
              </p>
              <p className={`text-[11px] mt-0.5 ${isAdmin ? 'text-white/50' : 'text-muted-foreground'}`}>{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6">

        {/* ── Quick actions ── */}
        <div className="mb-6">
          <p className="section-label mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(action => (
              <Link key={action.href} href={action.href}>
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-150 group cursor-pointer card-hover">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${action.color} shadow-sm group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] font-medium text-foreground leading-tight">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* Left column */}
          <div className="space-y-6">

            {/* Studies */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <FlaskConical className="w-4 h-4" style={{ color: researcherColor }} />
                    {isAdmin ? 'All Studies' : 'Your Studies'}
                  </CardTitle>
                  <Link href="/studies" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {studies?.length ? (
                  studies.map((study: Study) => (
                    <StudyCard
                      key={study.id}
                      id={study.id}
                      title={study.title}
                      instruments={instrumentsByStudy[study.id] || []}
                      participantCount={study.participant_count || 0}
                      completionPercentage={study.completion_percentage || 0}
                      researcherColor={researcherColor}
                    />
                  ))
                ) : (
                  <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <FlaskConical className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="font-serif text-base text-foreground mb-1">No studies yet</p>
                    <p className="text-sm text-muted-foreground mb-4">Science does not do itself.</p>
                    <Button asChild size="sm">
                      <Link href="/studies/new"><Plus className="w-3.5 h-3.5 mr-1.5" />Create your first study</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin: researcher breakdown */}
            {isAdmin && researcherBreakdown.length > 0 && (
              <Card className="border-border overflow-hidden">
                <CardHeader className="pb-3 border-b border-border bg-muted/30">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-500" /> Researcher Activity
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-1">Who&apos;s doing what</p>
                </CardHeader>
                <CardContent className="p-3 space-y-1">
                  {researcherBreakdown.map(({ profile: r, studyCount, latestStudy }) => (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: r.researcher_color || '#6D28D9' }}
                      >
                        {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{r.full_name || r.email}</p>
                        {latestStudy && <p className="text-[10px] text-muted-foreground truncate">Latest: {latestStudy}</p>}
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums text-[10px]">
                        {studyCount} {studyCount === 1 ? 'study' : 'studies'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Platform researchers */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-500" /> Platform Researchers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {peers?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {peers.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: r.researcher_color || '#6D28D9' }}
                        >
                          {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                        </div>
                        <span className="text-[13px] font-medium">{r.full_name?.split(' ')[0] || 'Researcher'}</span>
                        <span className="text-[10px] text-muted-foreground capitalize opacity-70">{r.role}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="You are the pioneer." subtitle="No other researchers yet. Lonely but legendary." />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Clinical alerts */}
            {(clinicalAlerts?.length ?? 0) > 0 && (
              <Card className="border-destructive/30 bg-destructive/5 overflow-hidden">
                <CardHeader className="pb-2 border-b border-destructive/20">
                  <CardTitle className="font-serif text-base text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Clinical Alerts
                  </CardTitle>
                  <p className="text-[10px] text-destructive/70 mt-1">
                    Do not ignore these. Please. 🙏
                  </p>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {clinicalAlerts!.map((alert: ClinicalAlertType) => (
                    <ClinicalAlert
                      key={alert.id}
                      id={alert.id}
                      severity={alert.severity}
                      message={alert.message}
                      participantId={alert.participant_id}
                      createdAt={alert.created_at}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Activity feed */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-500" /> Live Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {recentActivity?.length ? (
                  <div className="space-y-2">
                    {recentActivity.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-2.5 py-1.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activityDot(a.action_type)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground truncate capitalize">{activityLabel(a)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No activity yet." subtitle="The calm before the data storm. 🌊" />
                )}
              </CardContent>
            </Card>

            {/* Resources */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                {[
                  { href: '/scale-library', icon: Library,     label: 'Browse Scale Library',    color: 'text-sky-500'     },
                  { href: '/audit-log',     icon: ClipboardList,label: 'View Audit Log',          color: 'text-amber-500'   },
                  { href: '/participants',  icon: Mail,          label: 'Manage Participants',     color: 'text-emerald-500' },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/70 transition-colors group"
                  >
                    <link.icon className={`w-4 h-4 shrink-0 ${link.color} group-hover:scale-110 transition-transform`} />
                    <span className="text-[13px] font-medium text-foreground">{link.label}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
