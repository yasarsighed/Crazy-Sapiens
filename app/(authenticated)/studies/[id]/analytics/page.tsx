import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BarChart3, ClipboardList, Timer, Users, TrendingUp } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  QuestionnaireSummary,
  IatSummary,
  CompletionFunnel,
  type QInstrumentStats,
  type IatStats,
  type FunnelRow,
} from '@/components/study-analytics-charts'

// ── Math helpers ─────────────────────────────────────────────────────────────
function mean(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0 }
function sd(a: number[]) {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length)
}

export default async function StudyAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studyId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Study info
  const { data: study } = await supabase
    .from('studies').select('id, title, status, created_by')
    .eq('id', studyId).single()
  if (!study) redirect('/studies')

  // Enrolled participants
  const { count: enrolledCount } = await supabase
    .from('study_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('study_id', studyId)

  // ── Questionnaire analytics ───────────────────────────────────────────────
  const { data: qInstrs } = await supabase
    .from('questionnaire_instruments')
    .select('id, title, validated_scale_name, status')
    .eq('study_id', studyId)

  const qStats: QInstrumentStats[] = []

  for (const qi of qInstrs ?? []) {
    const { data: results } = await supabase
      .from('questionnaire_scored_results')
      .select('total_score, severity_label')
      .eq('questionnaire_id', qi.id)
      .eq('is_complete', true)

    const scores = (results ?? []).map(r => Number(r.total_score)).filter(s => !isNaN(s))
    const enrolled = enrolledCount ?? 0

    // Severity counts
    const severityMap: Record<string, number> = {}
    for (const r of results ?? []) {
      const lbl = (r.severity_label ?? 'Unknown').trim()
      severityMap[lbl] = (severityMap[lbl] ?? 0) + 1
    }
    const severityCounts = Object.entries(severityMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

    qStats.push({
      id: qi.id,
      title: qi.title,
      scaleName: qi.validated_scale_name,
      n: enrolled,
      completed: scores.length,
      mean: mean(scores),
      sd: sd(scores),
      min: scores.length ? Math.min(...scores) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      scores,
      severityCounts,
    })
  }

  // ── IAT analytics ─────────────────────────────────────────────────────────
  const { data: iatInstrs } = await supabase
    .from('iat_instruments')
    .select('id, title, iat_type')
    .eq('study_id', studyId)

  const iatStats: IatStats[] = []
  for (const iat of iatInstrs ?? []) {
    const { data: results } = await supabase
      .from('iat_session_results')
      .select('d_score')
      .eq('iat_id', iat.id)

    const dScores = (results ?? [])
      .map(r => Number(r.d_score))
      .filter(d => !isNaN(d) && isFinite(d))

    iatStats.push({
      id: iat.id,
      title: iat.title,
      iatType: iat.iat_type,
      n: enrolledCount ?? 0,
      completed: dScores.length,
      dScores,
      mean: mean(dScores),
      sd: sd(dScores),
    })
  }

  // ── Completion funnel ─────────────────────────────────────────────────────
  const enrolled = enrolledCount ?? 0
  const TYPE_COLORS: Record<string, string> = {
    questionnaire: '#C6A8F0',
    iat: '#CE2029',
    sociogram: '#86C99A',
  }

  const funnelRows: FunnelRow[] = [
    ...qStats.map(q => ({
      label: `📋 ${q.title}`,
      enrolled,
      completed: q.completed,
      pct: enrolled > 0 ? Math.round((q.completed / enrolled) * 100) : 0,
      color: TYPE_COLORS.questionnaire,
    })),
    ...iatStats.map(i => ({
      label: `⏱️ ${i.title}`,
      enrolled,
      completed: i.completed,
      pct: enrolled > 0 ? Math.round((i.completed / enrolled) * 100) : 0,
      color: TYPE_COLORS.iat,
    })),
  ]

  // Sociogram completion
  const { data: socInstrs } = await supabase
    .from('sociogram_instruments')
    .select('id, title')
    .eq('study_id', studyId)

  for (const soc of socInstrs ?? []) {
    const { count: submittedCount } = await supabase
      .from('sociogram_participants')
      .select('*', { count: 'exact', head: true })
      .eq('sociogram_id', soc.id)
      .eq('has_submitted', true)

    funnelRows.push({
      label: `🔗 ${soc.title}`,
      enrolled,
      completed: submittedCount ?? 0,
      pct: enrolled > 0 ? Math.round(((submittedCount ?? 0) / enrolled) * 100) : 0,
      color: TYPE_COLORS.sociogram,
    })
  }

  // ── Overall stats ─────────────────────────────────────────────────────────
  const totalInstruments = (qInstrs?.length ?? 0) + (iatInstrs?.length ?? 0) + (socInstrs?.length ?? 0)
  const avgCompletion = funnelRows.length
    ? Math.round(funnelRows.reduce((a, r) => a + r.pct, 0) / funnelRows.length)
    : 0

  const { count: alertsCount } = await supabase
    .from('clinical_alerts_log')
    .select('*', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('acknowledged', false)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="px-6 lg:px-8 pt-7 pb-5 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <Link href={`/studies/${studyId}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-3 transition-colors w-fit">
          <ArrowLeft className="w-3 h-3" /> Back to study
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h1 className="font-serif text-2xl font-semibold text-foreground">{study.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Study Analytics Dashboard</p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6">

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Enrolled',      value: enrolled,        icon: Users,         color: '#CE2029' },
            { label: 'Instruments',   value: totalInstruments,icon: ClipboardList, color: '#C6A8F0' },
            { label: 'Avg completion',value: `${avgCompletion}%`, icon: TrendingUp,color: '#86C99A' },
            { label: 'Open alerts',   value: alertsCount ?? 0,icon: Timer,         color: (alertsCount ?? 0) > 0 ? '#DC2626' : '#6B6B80' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</span>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <p className="font-serif text-3xl font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="funnel">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="funnel" className="gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5" /> Completion
            </TabsTrigger>
            <TabsTrigger value="questionnaires" className="gap-1.5 text-xs">
              <ClipboardList className="w-3.5 h-3.5" /> Questionnaires
              {qStats.length > 0 && (
                <span className="ml-1 text-[10px] rounded-full px-1.5 py-px font-bold" style={{ color: '#C6A8F0', background: 'color-mix(in srgb, #C6A8F0 15%, var(--card))' }}>{qStats.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="iat" className="gap-1.5 text-xs">
              <Timer className="w-3.5 h-3.5" /> IAT
              {iatStats.length > 0 && (
                <span className="ml-1 text-[10px] rounded-full px-1.5 py-px font-bold" style={{ color: '#CE2029', background: 'color-mix(in srgb, #CE2029 15%, var(--card))' }}>{iatStats.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funnel">
            <div className="mb-4">
              <h2 className="font-serif text-lg font-semibold mb-1">Completion Funnel</h2>
              <p className="text-sm text-muted-foreground">
                How many of the {enrolled} enrolled participants completed each instrument.
              </p>
            </div>
            <CompletionFunnel rows={funnelRows} />
          </TabsContent>

          <TabsContent value="questionnaires">
            <div className="mb-4">
              <h2 className="font-serif text-lg font-semibold mb-1">Questionnaire Results</h2>
              <p className="text-sm text-muted-foreground">
                Score distributions, summary statistics, and severity bands per scale.
              </p>
            </div>
            <QuestionnaireSummary stats={qStats} />
          </TabsContent>

          <TabsContent value="iat">
            <div className="mb-4">
              <h2 className="font-serif text-lg font-semibold mb-1">IAT Results</h2>
              <p className="text-sm text-muted-foreground">
                D-score distributions and implicit preference categories. D &gt; 0.35 = moderate preference; D &gt; 0.65 = strong preference.
              </p>
            </div>
            <IatSummary stats={iatStats} />
          </TabsContent>
        </Tabs>

        {/* Footer note */}
        <p className="text-[11px] text-muted-foreground mt-8 italic">
          Statistics are computed on completed responses only. Descriptive statistics are shown; inferential analyses should be conducted using the exported CSV in a statistics package.
        </p>
      </div>
    </div>
  )
}
