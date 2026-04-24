import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { StudyCard } from '@/components/study-card'
import { ClinicalAlert } from '@/components/clinical-alert'
import { EmptyState } from '@/components/empty-state'
import { HelpCircle, Plus, ExternalLink, Library, Mail, ClipboardList, ShieldAlert } from 'lucide-react'
import type { Profile, Study, ClinicalAlert as ClinicalAlertType } from '@/types/database'

const morningGreetings = [
  (name: string) => `Good morning, ${name}. Coffee first. p-values second.`,
  (name: string) => `Good morning, ${name}. The data won&apos;t collect itself, and honestly, neither will the coffee.`,
  (name: string) => `Rise and hypothesise, ${name}.`,
]
const afternoonGreetings = [
  (name: string) => `Good afternoon, ${name}. Correlation isn&apos;t causation, but opening this dashboard definitely caused it to load.`,
  (name: string) => `Good afternoon, ${name}. Halfway through the day. Still more data to collect than Freud had opinions.`,
  (name: string) => `Good afternoon, ${name}. Your participants are out there implicitly associating things as we speak.`,
]
const eveningGreetings = [
  (name: string) => `Good evening, ${name}. Still here? That level of dedication is either inspiring or a coping mechanism. The AAQ-II will tell us.`,
  (name: string) => `Good evening, ${name}. The IRB approved the study. Nobody approved staying this late.`,
  (name: string) => `Good evening, ${name}. B. F. Skinner would call this a conditioned response to impending deadlines.`,
]
const generalGreetings = [
  (name: string) => `Hello, ${name}. Freud would have had opinions about your research topic. Fortunately, he is not here.`,
  (name: string) => `Welcome back, ${name}. The null hypothesis today is that nothing interesting will happen. Let&apos;s reject it.`,
  (name: string) => `Hey, ${name}. Pavlov&apos;s dogs salivated at a bell. You opened a research dashboard. We&apos;re all shaped by our environments.`,
  (name: string) => `Welcome back, ${name}. Your participants missed you. Probably. We didn&apos;t run a study on it.`,
]

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  let pool: ((n: string) => string)[]
  if (hour < 12) pool = morningGreetings
  else if (hour < 17) pool = afternoonGreetings
  else if (hour < 22) pool = eveningGreetings
  else pool = generalGreetings
  return pool[Math.floor(Math.random() * pool.length)](name)
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return 'Researcher'
  return fullName.split(' ')[0]
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch studies — admin sees all, researchers see their own
  let studiesQuery = supabase
    .from('studies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  if (!isAdmin) studiesQuery = studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery

  const studyIds = studies?.map(s => s.id) || []

  // Fetch instruments from all 3 type-specific tables directly
  // (avoids relying on study_instruments which may have RLS issues)
  const [qInstrData, socInstrData, iatInstrData] = await Promise.all([
    studyIds.length > 0
      ? supabase.from('questionnaire_instruments').select('id, study_id').in('study_id', studyIds)
      : Promise.resolve({ data: [] as { id: string; study_id: string }[] }),
    studyIds.length > 0
      ? supabase.from('sociogram_instruments').select('id, study_id').in('study_id', studyIds)
      : Promise.resolve({ data: [] as { id: string; study_id: string }[] }),
    studyIds.length > 0
      ? supabase.from('iat_instruments').select('id, study_id').in('study_id', studyIds)
      : Promise.resolve({ data: [] as { id: string; study_id: string }[] }),
  ])

  // Build instrumentsByStudy for StudyCard badges
  const instrumentsByStudy: Record<string, Array<{ type: 'questionnaire' | 'iat' | 'sociogram' }>> = {}
  for (const i of (qInstrData.data || [])) {
    if (!instrumentsByStudy[i.study_id]) instrumentsByStudy[i.study_id] = []
    instrumentsByStudy[i.study_id].push({ type: 'questionnaire' })
  }
  for (const i of (socInstrData.data || [])) {
    if (!instrumentsByStudy[i.study_id]) instrumentsByStudy[i.study_id] = []
    instrumentsByStudy[i.study_id].push({ type: 'sociogram' })
  }
  for (const i of (iatInstrData.data || [])) {
    if (!instrumentsByStudy[i.study_id]) instrumentsByStudy[i.study_id] = []
    instrumentsByStudy[i.study_id].push({ type: 'iat' })
  }

  // Fetch clinical alerts
  const { data: clinicalAlerts } = await supabase
    .from('clinical_alerts_log')
    .select('*')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(5)

  // --- Stats ---
  let activeStudiesCountQuery = supabase
    .from('studies')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
  if (!isAdmin) activeStudiesCountQuery = activeStudiesCountQuery.eq('created_by', user.id)
  const { count: activeStudiesCount } = await activeStudiesCountQuery

  const { count: totalParticipantsCount } = studyIds.length > 0
    ? await supabase
        .from('study_enrollments')
        .select('*', { count: 'exact', head: true })
        .in('study_id', studyIds)
    : { count: 0 }

  // Completed surveys: count actual questionnaire completions
  const qIds = (qInstrData.data || []).map(q => q.id)
  const { count: responsesCount } = qIds.length > 0
    ? await supabase
        .from('questionnaire_scored_results')
        .select('*', { count: 'exact', head: true })
        .in('questionnaire_id', qIds)
        .eq('is_complete', true)
    : { count: 0 }

  const { count: alertsCount } = await supabase
    .from('clinical_alerts_log')
    .select('*', { count: 'exact', head: true })
    .eq('acknowledged', false)

  // Other researchers on platform
  const { data: researchers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'researcher')
    .neq('id', user.id)
    .limit(5)

  // Admin-only: per-researcher study breakdown
  let researcherBreakdown: Array<{ profile: Profile; studyCount: number; latestStudy: string | null }> = []
  if (isAdmin) {
    const { data: allResearchers } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['researcher', 'admin'])
    const { data: allStudies } = await supabase
      .from('studies')
      .select('id, title, created_by, created_at')
      .order('created_at', { ascending: false })
    const byResearcher = new Map<string, { count: number; latest: string | null }>()
    for (const s of allStudies ?? []) {
      const curr = byResearcher.get(s.created_by) ?? { count: 0, latest: null }
      curr.count++
      if (!curr.latest) curr.latest = s.title
      byResearcher.set(s.created_by, curr)
    }
    researcherBreakdown = (allResearchers ?? [])
      .map((r: Profile) => {
        const stat = byResearcher.get(r.id)
        return { profile: r, studyCount: stat?.count ?? 0, latestStudy: stat?.latest ?? null }
      })
      .filter(x => x.studyCount > 0)
      .sort((a, b) => b.studyCount - a.studyCount)
  }

  // Recent activity — scoped to current user unless admin
  const activityBaseQuery = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8)
  const { data: recentActivity } = isAdmin
    ? await activityBaseQuery
    : await activityBaseQuery.eq('user_id', user.id)

  const firstName = getFirstName(profile?.full_name)
  const greeting = getGreeting(firstName)
  const researcherColor = profile?.researcher_color || '#2D6A4F'

  return (
    <div className="p-6 lg:p-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-serif text-2xl text-foreground"
            dangerouslySetInnerHTML={{ __html: greeting }}
          />
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Admin view — showing all studies
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <HelpCircle className="w-5 h-5" />
          </Button>
          {!isAdmin && (
            <Button asChild>
              <Link href="/studies/new">
                <Plus className="w-4 h-4 mr-2" />
                New study
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={isAdmin ? 'All Active Studies' : 'Active Studies'}
          value={activeStudiesCount || 0}
          subtitle="running simultaneously (very on-brand)"
          variant="researcher-color"
        />
        <StatCard
          title="Total Participants"
          value={totalParticipantsCount || 0}
          subtitle="humans who said yes (bless them)"
        />
        <StatCard
          title="Completed Surveys"
          value={responsesCount || 0}
          subtitle="feelings formally quantified"
        />
        <StatCard
          title="Clinical Alerts"
          value={alertsCount || 0}
          subtitle="eyes on these. now."
          variant="alert"
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Studies */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-base">
                  {isAdmin ? 'All studies' : 'Your studies'}
                </CardTitle>
                <Link
                  href="/studies"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View all <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {studies && studies.length > 0 ? (
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
                <EmptyState title="No studies yet." subtitle="Even Freud had to start somewhere. He started badly, but still." />
              )}
            </CardContent>
          </Card>

          {/* Admin: who's working on what */}
          {isAdmin && researcherBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base">Researcher activity</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-1">Who&apos;s working on what</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {researcherBreakdown.map(({ profile: r, studyCount, latestStudy }) => (
                  <div key={r.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                      style={{ backgroundColor: r.researcher_color || '#2D6A4F' }}
                    >
                      {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.full_name || r.email}</p>
                      {latestStudy && (
                        <p className="text-[10px] text-muted-foreground truncate">Latest: {latestStudy}</p>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {studyCount} stud{studyCount === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Platform researchers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">Platform researchers</CardTitle>
            </CardHeader>
            <CardContent>
              {researchers && researchers.length > 0 ? (
                <div className="space-y-3">
                  {researchers.map((researcher: Profile) => (
                    <div key={researcher.id} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                        style={{ backgroundColor: researcher.researcher_color || '#2D6A4F' }}
                      >
                        {researcher.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {researcher.full_name || 'Researcher'}
                        </p>
                      </div>
                      <div
                        className="w-4 h-4 rounded shrink-0"
                        style={{ backgroundColor: researcher.researcher_color || '#2D6A4F' }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No other researchers yet." subtitle="Enjoy the methodological solitude while it lasts." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Clinical alerts — only rendered when present */}
          {clinicalAlerts && clinicalAlerts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-base">Clinical alerts</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-1">
                  These are real. Handle with care. No jokes here.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {clinicalAlerts.map((alert: ClinicalAlertType) => (
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

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        activity.action_type === 'enrollment' ? 'bg-green-500' :
                        activity.action_type === 'alert'      ? 'bg-destructive' :
                        activity.action_type === 'completion' ? 'bg-primary' :
                        'bg-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground line-clamp-2">
                          {activity.action_type}: {activity.entity_type}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing yet." subtitle="The observer effect is real — you're watching and nothing is happening." />
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/scale-library"
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                <Library className="w-4 h-4 text-muted-foreground" />
                <span>Scale library</span>
              </Link>
              <Link
                href="/invitations"
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>Manage invitations</span>
              </Link>
              <Link
                href="/audit-log"
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <span>View audit log</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
