import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Users, ClipboardList, Timer, AlertTriangle, TrendingUp } from 'lucide-react'
import { IAT_TYPES, bandForD } from '@/lib/iat-types'
import { fetchAllRows } from '@/lib/fetch-all'

function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function sd(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function severityColor(label: string | null): string {
  if (!label) return '#888888'
  const b = label.toLowerCase()
  if (b.includes('minimal') || b.includes('none')) return '#52B788'
  if (b.includes('mild')) return '#E9C46A'
  if (b.includes('moderately severe')) return '#E63946'
  if (b.includes('moderate')) return '#F0A65C'
  if (b.includes('severe')) return '#E63946'
  return '#888888'
}

export default async function AnalysisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch all studies this researcher owns (admin sees all)
  const studiesQuery = supabase
    .from('studies')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })

  if (!isAdmin) studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery

  const studyIds = (studies ?? []).map(s => s.id)

  if (studyIds.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl">
        <h1 className="font-serif text-2xl mb-1">Analysis</h1>
        <p className="text-sm text-muted-foreground mb-8">Cross-study statistics</p>
        <div className="text-center py-24">
          <BarChart3 className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
          <p className="font-serif text-xl mb-2">No studies yet.</p>
          <p className="text-sm text-muted-foreground mb-4">Create a study and collect data to see analysis here.</p>
          <Link href="/studies/new" className="text-sm text-primary hover:underline">Create your first study →</Link>
        </div>
      </div>
    )
  }

  // Questionnaire instruments (for scale names) — fetched first since the
  // results query below filters by their ids.
  const { data: allQInstruments } = await supabase
    .from('questionnaire_instruments')
    .select('id, title, validated_scale_name, study_id')
    .in('study_id', studyIds)

  // IAT instruments (need iat_type so each IAT's D-scores get judged against
  // ITS OWN band system, not a different IAT's — see fix below)
  const { data: allIatInstruments } = await supabase
    .from('iat_instruments')
    .select('id, title, iat_type')
    .in('study_id', studyIds)

  // The queries below scale with participant × response count, not study
  // count — an unbounded .select() silently truncates at Supabase's ~1000-row
  // default once real usage grows (this app's iat_trial_log already holds
  // 14,400+ rows), so every one of these pages through with fetchAllRows.
  const qInstrumentIds = (allQInstruments ?? []).map(q => q.id)
  const { data: allQResults } = await fetchAllRows((from, to) =>
    supabase
      .from('questionnaire_scored_results')
      .select('questionnaire_id, participant_id, total_score, severity_label, submitted_at')
      .in('questionnaire_id', qInstrumentIds)
      .eq('is_complete', true)
      .range(from, to),
  )

  const iatInstrumentIds = (allIatInstruments ?? []).map(i => i.id)
  const { data: allIatResults } = await fetchAllRows((from, to) =>
    supabase
      .from('iat_session_results')
      .select('iat_id, participant_id, d_score')
      .in('iat_id', iatInstrumentIds)
      .range(from, to),
  )

  const { data: allEnrollments } = await fetchAllRows((from, to) =>
    supabase
      .from('study_enrollments')
      .select('study_id, participant_id, status')
      .in('study_id', studyIds)
      .eq('status', 'active')
      .range(from, to),
  )

  // Unacknowledged clinical alerts
  const { data: unackAlerts } = await fetchAllRows((from, to) =>
    supabase
      .from('clinical_alerts_log')
      .select('id, study_id, participant_id, alert_level, created_at')
      .in('study_id', studyIds)
      .eq('acknowledged', false)
      .range(from, to),
  )

  // Aggregate stats
  const totalParticipants = new Set((allEnrollments ?? []).map(e => e.participant_id)).size
  const totalSubmissions  = (allQResults ?? []).length
  const totalIatSessions  = (allIatResults ?? []).length
  const totalAlerts       = (unackAlerts ?? []).length

  const allScores = (allQResults ?? [])
    .map(r => r.total_score)
    .filter((s): s is number => s !== null)
  const allDScores = (allIatResults ?? [])
    .map(r => r.d_score)
    .filter((d): d is number => d !== null)

  // Group IAT D-scores by their actual iat_type — pooling scores from
  // unrelated IATs (e.g. a political-attitude IAT and the Death/Suicide IAT)
  // into a single distribution and judging all of them against the
  // Death/Suicide band labels would misrepresent unrelated scores as
  // clinical risk. Each type gets its own distribution using its own bands.
  const iatTypeById = Object.fromEntries((allIatInstruments ?? []).map(i => [i.id, i.iat_type]))
  const dScoresByType: Record<string, number[]> = {}
  for (const r of allIatResults ?? []) {
    if (r.d_score === null) continue
    const key = iatTypeById[r.iat_id] ?? 'death_suicide'
    ;(dScoresByType[key] ??= []).push(r.d_score)
  }

  // Per-scale aggregates
  const scaleMap: Record<string, { name: string; scores: number[]; severities: Record<string, number> }> = {}
  for (const r of allQResults ?? []) {
    const instr = (allQInstruments ?? []).find(q => q.id === r.questionnaire_id)
    const scaleName = instr?.validated_scale_name ?? instr?.title ?? 'Unknown'
    if (!scaleMap[scaleName]) scaleMap[scaleName] = { name: scaleName, scores: [], severities: {} }
    if (r.total_score !== null) scaleMap[scaleName].scores.push(r.total_score)
    if (r.severity_label) {
      scaleMap[scaleName].severities[r.severity_label] = (scaleMap[scaleName].severities[r.severity_label] ?? 0) + 1
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-2xl mb-1">Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Aggregated statistics across {studies?.length ?? 0} {isAdmin ? 'all' : 'your'} {(studies?.length ?? 0) === 1 ? 'study' : 'studies'}
        </p>
      </div>

      {/* Summary stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Participants</p>
            </div>
            <p className="text-2xl font-serif font-semibold">{totalParticipants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Q submissions</p>
            </div>
            <p className="text-2xl font-serif font-semibold">{totalSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">IAT sessions</p>
            </div>
            <p className="text-2xl font-serif font-semibold">{totalIatSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <p className="text-xs text-muted-foreground">Unack. alerts</p>
            </div>
            <p className={`text-2xl font-serif font-semibold ${totalAlerts > 0 ? 'text-destructive' : ''}`}>
              {totalAlerts}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Per-scale distributions */}
        {Object.values(scaleMap).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                Questionnaire distributions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.values(scaleMap).map(scale => {
                const m = mean(scale.scores)
                const s = sd(scale.scores)
                const totalN = scale.scores.length
                const topSeverities = Object.entries(scale.severities)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)

                return (
                  <div key={scale.name} className="border-b border-border last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">{scale.name}</p>
                      <Badge variant="outline" className="text-[10px]">n = {totalN}</Badge>
                    </div>
                    {totalN > 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Mean: <span className="text-foreground font-mono font-medium">{m.toFixed(1)}</span>
                        {' '}· SD: <span className="text-foreground font-mono font-medium">{s.toFixed(1)}</span>
                      </p>
                    )}
                    {topSeverities.length > 0 && (
                      <div className="space-y-1.5">
                        {topSeverities.map(([label, count]) => (
                          <div key={label} className="flex items-center gap-2 text-xs">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: severityColor(label) }}
                              aria-label={label}
                            />
                            <span className="text-muted-foreground w-28 truncate">{label}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(count / totalN) * 100}%`,
                                  backgroundColor: severityColor(label),
                                }}
                              />
                            </div>
                            <span className="text-muted-foreground w-6 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* IAT D-score distributions — one per IAT type, each judged against
            its own band system. Never pool D-scores across different IATs:
            a high D-score on a stereotype/political-attitude IAT means
            something completely different from a high D-score on the
            Death/Suicide IAT, and must never be framed with the same
            clinical-risk language. */}
        {allDScores.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                IAT D-score distributions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {IAT_TYPES.filter(t => dScoresByType[t.key]?.length).map(iatType => {
                const scores = dScoresByType[iatType.key]
                const n = scores.length
                const clinicalCount = scores.filter(d => bandForD(d, iatType.dscore_bands).clinical).length

                return (
                  <div key={iatType.key} className="border-b border-border last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">{iatType.name}</p>
                      <Badge variant="outline" className="text-[10px]">n = {n}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Mean D = <span className="font-mono text-foreground">{mean(scores).toFixed(3)}</span>
                      {' '}· SD = <span className="font-mono text-foreground">{sd(scores).toFixed(3)}</span>
                    </p>
                    <div className="space-y-1.5">
                      {iatType.dscore_bands.map(band => {
                        const count = scores.filter(d => bandForD(d, iatType.dscore_bands) === band).length
                        const pct = n > 0 ? (count / n) * 100 : 0
                        return (
                          <div key={band.label} className="flex items-center gap-2 text-xs">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: band.color }}
                              aria-label={band.label}
                            />
                            <span className="text-muted-foreground w-40 truncate">
                              {band.short.replace(/\s*⚑$/, '')}
                              {band.clinical && count > 0 && (
                                <span className="ml-1 text-destructive font-medium">⚑</span>
                              )}
                            </span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: band.color }}
                              />
                            </div>
                            <span className="text-muted-foreground w-6 text-right">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                    {clinicalCount > 0 && (
                      <p className="text-xs text-destructive mt-2">
                        ⚑ {clinicalCount} participant(s) in a clinical-flag band for this instrument.
                        Ensure clinical alerts are acknowledged.
                      </p>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Per-study breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Per-study breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Study</th>
                  <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-2 pr-4 text-xs text-muted-foreground font-medium">Participants</th>
                  <th className="text-right py-2 pr-4 text-xs text-muted-foreground font-medium">Q submissions</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Alerts</th>
                </tr>
              </thead>
              <tbody>
                {(studies ?? []).map(study => {
                  const studyEnrollments = (allEnrollments ?? []).filter(e => e.study_id === study.id)
                  const studyQIds = (allQInstruments ?? []).filter(q => q.study_id === study.id).map(q => q.id)
                  const studySubmissions = (allQResults ?? []).filter(r => studyQIds.includes(r.questionnaire_id))
                  const studyAlerts = (unackAlerts ?? []).filter(a => a.study_id === study.id)

                  return (
                    <tr key={study.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4">
                        <Link href={`/studies/${study.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {study.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={study.status === 'active' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {study.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {studyEnrollments.length}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {studySubmissions.length}
                      </td>
                      <td className="py-3 text-right">
                        {studyAlerts.length > 0 ? (
                          <span className="text-destructive font-medium">{studyAlerts.length} !</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6 italic text-center">
        Significant does not mean important. Effect size matters. Your supervisor would want you to remember that.
      </p>
    </div>
  )
}
