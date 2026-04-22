import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Eye, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AcknowledgeAlertButton } from '@/components/acknowledge-alert-button'
import { BUILT_IN_SCALES } from '@/lib/scales'

// Severity band → colour
function severityColor(band: string | null): string {
  if (!band) return '#888888'
  const b = band.toLowerCase()
  if (b.includes('minimal') || b.includes('none')) return '#52B788'
  if (b.includes('mild')) return '#E9C46A'
  if (b.includes('moderately severe')) return '#E63946'
  if (b.includes('moderate')) return '#F4A261'
  if (b.includes('severe')) return '#E63946'
  return '#888888'
}

// Distribution of severity bands from all results
function buildDistribution(
  results: any[],
  bands: string[]
): { band: string; count: number; color: string }[] {
  const counts: Record<string, number> = {}
  for (const band of bands) counts[band] = 0
  for (const r of results) {
    const b = r.severity_label ?? 'Unknown'
    counts[b] = (counts[b] ?? 0) + 1
  }
  return Object.entries(counts).map(([band, count]) => ({
    band,
    count,
    color: severityColor(band),
  }))
}

export default async function QuestionnaireResultsPage({
  params,
}: {
  params: { id: string; qid: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: studyId, qid } = params

  // Fetch questionnaire instrument details
  const { data: questionnaire } = await supabase
    .from('questionnaire_instruments')
    .select('id, title, instructions, validated_scale_name, validated_scale_citation, clinical_alert_enabled, clinical_alert_threshold, estimated_duration_minutes, auto_score')
    .eq('id', qid)
    .single()

  if (!questionnaire) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Questionnaire not found.</p>
      </div>
    )
  }

  // Fetch study for breadcrumb
  const { data: study } = await supabase
    .from('studies')
    .select('id, title')
    .eq('id', studyId)
    .single()

  // Fetch all scored results for this questionnaire
  const { data: results } = await supabase
    .from('questionnaire_scored_results')
    .select(
      'participant_id, total_score, severity_label, severity_category, submitted_at, is_complete'
    )
    .eq('questionnaire_id', qid)
    .order('submitted_at', { ascending: false })

  // Fetch participant profiles for all result rows
  const participantIds = [...new Set((results ?? []).map((r: any) => r.participant_id))]
  const { data: profiles } = participantIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', participantIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  // Fetch clinical alerts triggered for this questionnaire's participants
  const { data: alerts } = participantIds.length > 0
    ? await supabase
        .from('clinical_alerts_log')
        .select('id, participant_id, severity, acknowledged, acknowledged_notes, created_at, questionnaire_id')
        .in('participant_id', participantIds)
        .eq('questionnaire_id', qid)
    : { data: [] }

  const alertsByParticipant: Record<string, any[]> = {}
  for (const a of alerts ?? []) {
    if (!alertsByParticipant[a.participant_id]) alertsByParticipant[a.participant_id] = []
    alertsByParticipant[a.participant_id].push(a)
  }

  // Stats
  const completedResults = (results ?? []).filter((r: any) => r.is_complete)
  const scores = completedResults.map((r: any) => r.total_score).filter((s: any) => s !== null)
  const meanScore = scores.length
    ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)
    : null
  const maxScore = scores.length ? Math.max(...scores) : null
  const minScore = scores.length ? Math.min(...scores) : null

  // Build band order from BUILT_IN_SCALES; fall back to unique labels in results
  const matchedScale = BUILT_IN_SCALES.find(
    s => s.abbreviation === questionnaire.validated_scale_name
  )
  const bandOrder: string[] = matchedScale
    ? matchedScale.severity_bands.map(b => b.label)
    : [...new Set(completedResults.map((r: any) => r.severity_label).filter(Boolean))]
  const distribution = bandOrder.length > 0 ? buildDistribution(completedResults, bandOrder) : []

  const unacknowledgedAlerts = (alerts ?? []).filter((a: any) => !a.acknowledged)

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/studies" className="hover:text-foreground">Studies</Link>
        <span>/</span>
        <Link href={`/studies/${studyId}`} className="hover:text-foreground">{study?.title ?? studyId}</Link>
        <span>/</span>
        <span className="text-foreground">{questionnaire.title}</span>
      </div>

      <Link
        href={`/studies/${studyId}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to study
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-3 mb-1 flex-wrap">
          <h1 className="font-serif text-2xl text-foreground">{questionnaire.title}</h1>
          {questionnaire.validated_scale_name && (
            <Badge variant="outline" className="mt-1 border-[#457B9D] text-[#457B9D]">
              {questionnaire.validated_scale_name}
            </Badge>
          )}
          <Link
            href={`/participant/questionnaire/${qid}?preview=1`}
            target="_blank"
            className="mt-1 ml-auto inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Eye className="w-3.5 h-3.5" /> Preview as participant
          </Link>
        </div>
        {questionnaire.instructions && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{questionnaire.instructions}</p>
        )}
        {questionnaire.validated_scale_citation && (
          <p className="text-xs text-muted-foreground mt-1 italic">{questionnaire.validated_scale_citation}</p>
        )}
      </div>

      {/* Clinical alert banner */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="flex items-start gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {unacknowledgedAlerts.length} unacknowledged clinical alert{unacknowledgedAlerts.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Heads up. These are serious. We do not joke about these.
            </p>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{completedResults.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{meanScore ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Mean score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{minScore ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Min score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{maxScore ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Max score</p>
          </CardContent>
        </Card>
      </div>

      {/* Severity distribution */}
      {distribution.length > 0 && completedResults.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Severity distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {distribution.map(({ band, count, color }) => {
                const pct = completedResults.length > 0 ? (count / completedResults.length) * 100 : 0
                return (
                  <div key={band} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-xs text-muted-foreground text-right">{band}</div>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="w-8 text-xs text-muted-foreground text-right">{count}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Individual results</CardTitle>
        </CardHeader>
        <CardContent>
          {completedResults.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-serif text-lg text-foreground mb-1">No submissions yet.</p>
              <p className="text-sm italic text-muted-foreground">The data awaits its moment of truth.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Participant</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Score</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Severity</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Submitted</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Alerts</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {completedResults.map((result: any, i: number) => {
                    const profile = profileMap[result.participant_id]
                    const participantAlerts = alertsByParticipant[result.participant_id] ?? []
                    const hasUnack = participantAlerts.some((a: any) => !a.acknowledged)
                    const ackedAlert = participantAlerts.find((a: any) => a.acknowledged && a.acknowledged_notes)
                    return (
                      <tr
                        key={`${result.participant_id}-${i}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium text-foreground">
                            {profile?.full_name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">{profile?.email ?? result.participant_id}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-serif text-lg font-semibold">{result.total_score ?? '—'}</span>
                        </td>
                        <td className="py-3 pr-4">
                          {result.severity_label ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: severityColor(result.severity_label) }}
                            >
                              {result.severity_label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {result.submitted_at
                              ? new Date(result.submitted_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {participantAlerts.length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs ${
                                    hasUnack ? 'text-destructive font-medium' : 'text-[#52B788]'
                                  }`}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {hasUnack ? `${participantAlerts.filter((a:any) => !a.acknowledged).length} unacknowledged` : 'Acknowledged'}
                                </span>
                                {hasUnack && (
                                  <AcknowledgeAlertButton
                                    participantId={result.participant_id}
                                    questionnaireId={qid}
                                  />
                                )}
                              </div>
                              {/* Show follow-up notes if acknowledged */}
                              {ackedAlert?.acknowledged_notes && (
                                <div className="flex items-start gap-1.5 mt-1">
                                  <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                                    {ackedAlert.acknowledged_notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-[#52B788]" />
                          )}
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/studies/${studyId}/questionnaire/${qid}/participant/${result.participant_id}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-2 py-1"
                          >
                            <Eye className="w-3 h-3" />
                            Responses
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground mt-6 italic text-center">
        Significant does not mean important. Effect size matters. Your supervisor would want you to remember that.
      </p>
    </div>
  )
}
