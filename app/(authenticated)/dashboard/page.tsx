import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { StudyCard } from '@/components/study-card'
import { ClinicalAlert } from '@/components/clinical-alert'
import { EmptyState } from '@/components/empty-state'
import { HelpCircle, Plus, ExternalLink, Library, Mail, ClipboardList } from 'lucide-react'
import type { Profile, Study, ClinicalAlert as ClinicalAlertType } from '@/types/database'

// Greeting messages that rotate
const greetings = [
  (name: string) => `Good morning, ${name}. The data won&apos;t collect itself.`,
  (name: string) => `Welcome back, ${name}. Your participants missed you. Probably.`,
  (name: string) => `Hello, ${name}. Let&apos;s make some science happen today.`,
  (name: string) => `Good to see you, ${name}. Your studies are patiently waiting.`,
]

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const randomIndex = Math.floor(Math.random() * greetings.length)
  let greeting = greetings[randomIndex](name)
  
  // Adjust greeting based on time of day
  if (hour >= 12 && hour < 17) {
    greeting = greeting.replace('Good morning', 'Good afternoon')
  } else if (hour >= 17 || hour < 5) {
    greeting = greeting.replace('Good morning', 'Good evening')
  }
  
  return greeting
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return 'Researcher'
  return fullName.split(' ')[0]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch studies for this researcher
  const { data: studies } = await supabase
    .from('studies')
    .select('*')
    .eq('researcher_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch study instruments for the studies
  const studyIds = studies?.map(s => s.id) || []
  const { data: studyInstruments } = studyIds.length > 0 
    ? await supabase
        .from('study_instruments')
        .select('*')
        .in('study_id', studyIds)
    : { data: [] }

  // Fetch clinical alerts (unacknowledged)
  const { data: clinicalAlerts } = await supabase
    .from('clinical_alerts_log')
    .select('*')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch dashboard stats
  const { count: activeStudiesCount } = await supabase
    .from('studies')
    .select('*', { count: 'exact', head: true })
    .eq('researcher_id', user.id)
    .eq('status', 'active')

  const { count: totalParticipantsCount } = await supabase
    .from('study_enrollments')
    .select('*', { count: 'exact', head: true })
    .in('study_id', studyIds)

  // Count completed enrollments as a cross-instrument proxy for responses
  const { count: responsesCount } = await supabase
    .from('study_enrollments')
    .select('*', { count: 'exact', head: true })
    .in('study_id', studyIds)
    .eq('status', 'completed')

  const { count: alertsCount } = await supabase
    .from('clinical_alerts_log')
    .select('*', { count: 'exact', head: true })
    .eq('acknowledged', false)

  // Fetch other researchers on the platform
  const { data: researchers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'researcher')
    .neq('id', user.id)
    .limit(5)

  // Fetch recent activity
  const { data: recentActivity } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8)

  const firstName = getFirstName(profile?.full_name)
  const greeting = getGreeting(firstName)
  const researcherColor = profile?.researcher_color || '#2D6A4F'

  // Group instruments by study
  const instrumentsByStudy = (studyInstruments || []).reduce((acc, inst) => {
    if (!acc[inst.study_id]) acc[inst.study_id] = []
    acc[inst.study_id].push({ type: inst.instrument_type })
    return acc
  }, {} as Record<string, Array<{ type: 'questionnaire' | 'iat' | 'sociogram' }>>)

  return (
    <div className="p-6 lg:p-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <h1 
          className="font-serif text-2xl text-foreground"
          dangerouslySetInnerHTML={{ __html: greeting }}
        />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <HelpCircle className="w-5 h-5" />
          </Button>
          <Button asChild>
            <Link href="/studies/new">
              <Plus className="w-4 h-4 mr-2" />
              New study
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Active Studies"
          value={activeStudiesCount || 0}
          subtitle="experiments in progress"
          variant="researcher-color"
        />
        <StatCard
          title="Total Participants"
          value={totalParticipantsCount || 0}
          subtitle="brave souls enrolled"
        />
        <StatCard
          title="Completed Surveys"
          value={responsesCount || 0}
          subtitle="instruments fully submitted"
        />
        <StatCard
          title="Clinical Alerts"
          value={alertsCount || 0}
          subtitle="requiring attention"
          variant="alert"
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Your studies */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-base">Your studies</CardTitle>
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
                <EmptyState
                  title="No studies yet."
                  subtitle="Science does not do itself."
                />
              )}
            </CardContent>
          </Card>

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
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
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
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: researcher.researcher_color || '#2D6A4F' }}
                        title="Researcher color"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No other researchers yet."
                  subtitle="You are the pioneer."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Clinical alerts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base">Clinical alerts</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                Heads up. These are serious. We do not joke about these.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinicalAlerts && clinicalAlerts.length > 0 ? (
                clinicalAlerts.map((alert: ClinicalAlertType) => (
                  <ClinicalAlert
                    key={alert.id}
                    id={alert.id}
                    severity={alert.severity}
                    message={alert.message}
                    participantId={alert.participant_id}
                    createdAt={alert.created_at}
                  />
                ))
              ) : (
                <EmptyState
                  title="All clear."
                  subtitle="Either everyone is thriving or nobody has submitted yet."
                />
              )}
            </CardContent>
          </Card>

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
                        activity.action_type === 'enrollment' ? 'bg-success' :
                        activity.action_type === 'alert' ? 'bg-destructive' :
                        activity.action_type === 'completion' ? 'bg-primary' :
                        'bg-accent-yellow'
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
                <EmptyState
                  title="No activity yet."
                  subtitle="The calm before the data storm."
                />
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
