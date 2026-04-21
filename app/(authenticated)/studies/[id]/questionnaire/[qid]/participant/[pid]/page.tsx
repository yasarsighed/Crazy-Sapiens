import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, AlertTriangle, MessageSquare, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default async function ParticipantResponsesPage({
  params,
}: {
  params: { id: string; qid: string; pid: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: studyId, qid, pid } = params

  // Fetch questionnaire
  const { data: questionnaire } = await supabase
    .from('questionnaire_instruments')
    .select('id, title, instructions, validated_scale_name, clinical_alert_threshold, clinical_alert_enabled')
    .eq('id', qid)
    .single()

  if (!questionnaire) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Questionnaire not found.</p>
      </div>
    )
  }

  // Fetch study
  const { data: study } = await supabase
    .from('studies')
    .select('id, title')
    .eq('id', studyId)
    .single()

  // Fetch participant profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', pid)
    .single()

  // Fetch items (ordered)
  const { data: items } = await supabase
    .from('questionnaire_items')
    .select('id, item_text, item_order, scale_min, scale_max, scale_min_label, scale_max_label, reverse_scored')
    .eq('questionnaire_id', qid)
    .order('item_order', { ascending: true })

  // Fetch this participant's item responses
  const { data: responses } = await supabase
    .from('questionnaire_item_responses')
    .select('item_id, response_value, scored_value')
    .eq('questionnaire_id', qid)
    .eq('participant_id', pid)

  const responseByItemId: Record<string, { response_value: number; scored_value: number | null }> = {}
  for (const r of responses ?? []) {
    responseByItemId[r.item_id] = r
  }

  // Fetch scored result
  const { data: scoredResult } = await supabase
    .from('questionnaire_scored_results')
    .select('total_score, severity_label, severity_category, submitted_at, is_complete')
    .eq('questionnaire_id', qid)
    .eq('participant_id', pid)
    .maybeSingle()

  // Fetch clinical alerts for this participant
  const { data: alerts } = await supabase
    .from('clinical_alerts_log')
    .select('id, severity, acknowledged, acknowledged_notes, created_at')
    .eq('questionnaire_id', qid)
    .eq('participant_id', pid)
    .order('created_at', { ascending: false })

  const hasUnacknowledgedAlert = (alerts ?? []).some((a: any) => !a.acknowledged)

  const itemsList = items ?? []
  const answeredCount = itemsList.filter(item => responseByItemId[item.id] !== undefined).length

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/studies" className="hover:text-foreground">Studies</Link>
        <span>/</span>
        <Link href={`/studies/${studyId}`} className="hover:text-foreground">{study?.title ?? studyId}</Link>
        <span>/</span>
        <Link href={`/studies/${studyId}/questionnaire/${qid}`} className="hover:text-foreground">{questionnaire.title}</Link>
        <span>/</span>
        <span className="text-foreground">{profile?.full_name ?? profile?.email ?? pid}</span>
      </div>

      <Link
        href={`/studies/${studyId}/questionnaire/${qid}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to results
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground mb-0.5">
          {profile?.full_name ?? 'Unknown participant'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? pid} · {questionnaire.title}
        </p>
      </div>

      {/* Clinical alert banner */}
      {hasUnacknowledgedAlert && (
        <div className="flex items-start gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Unacknowledged clinical alert</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Go to the results page to acknowledge and record follow-up action.
            </p>
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">
              {scoredResult?.total_score ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Total score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            {scoredResult?.severity_label ? (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: severityColor(scoredResult.severity_label) }}
              >
                {scoredResult.severity_label}
              </span>
            ) : (
              <p className="text-2xl font-serif font-semibold text-foreground">—</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Severity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">
              {answeredCount}/{itemsList.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Items answered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {scoredResult?.submitted_at
                ? new Date(scoredResult.submitted_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Clinical alert detail */}
      {(alerts ?? []).length > 0 && (
        <Card className="mb-8 border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Clinical alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(alerts ?? []).map((alert: any) => (
              <div key={alert.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={alert.acknowledged
                      ? 'border-[#52B788] text-[#52B788]'
                      : 'border-destructive text-destructive'}
                  >
                    {alert.acknowledged ? 'Acknowledged' : 'Unacknowledged'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {alert.acknowledged_notes ? (
                  <div className="flex items-start gap-1.5 mt-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground italic">{alert.acknowledged_notes}</p>
                  </div>
                ) : alert.acknowledged ? (
                  <p className="text-xs text-muted-foreground italic mt-1">No follow-up notes recorded.</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Item-by-item responses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Item responses</CardTitle>
        </CardHeader>
        <CardContent>
          {itemsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No items found for this questionnaire.</p>
          ) : (
            <div className="space-y-4">
              {itemsList.map((item: any, idx: number) => {
                const response = responseByItemId[item.id]
                const answered = response !== undefined
                const value = response?.response_value
                const scored = response?.scored_value

                // Build a simple visual scale
                const scaleMin = item.scale_min ?? 0
                const scaleMax = item.scale_max ?? 3
                const scaleRange = scaleMax - scaleMin
                const pct = answered && value !== null
                  ? ((value - scaleMin) / Math.max(scaleRange, 1)) * 100
                  : null

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-4 border ${
                      answered ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5 w-5 text-right">
                        {idx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">{item.item_text}</p>
                        {item.reverse_scored && (
                          <Badge variant="outline" className="text-[10px] mt-1">Reverse scored</Badge>
                        )}
                      </div>
                    </div>

                    {answered ? (
                      <div className="ml-8">
                        {/* Response scale visual */}
                        <div className="flex items-center gap-3 mb-1.5">
                          {item.scale_min_label && (
                            <span className="text-[11px] text-muted-foreground shrink-0 w-20 text-right">
                              {item.scale_min_label}
                            </span>
                          )}
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                            {pct !== null && (
                              <div
                                className="h-full bg-[#457B9D] rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            )}
                          </div>
                          {item.scale_max_label && (
                            <span className="text-[11px] text-muted-foreground shrink-0 w-20">
                              {item.scale_max_label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-0">
                          {item.scale_min_label ? (
                            <span className="text-[11px] text-muted-foreground w-20 text-right shrink-0" />
                          ) : null}
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-foreground">
                              {value}
                            </span>
                            {scored !== null && scored !== value && (
                              <span className="text-xs text-muted-foreground">
                                (scored: {scored})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-8">
                        <span className="text-xs text-muted-foreground italic">Not answered</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion status */}
      {scoredResult && (
        <div className={`mt-6 flex items-center gap-2 text-sm ${
          scoredResult.is_complete ? 'text-[#52B788]' : 'text-[#E9C46A]'
        }`}>
          <CheckCircle className="w-4 h-4" />
          {scoredResult.is_complete ? 'Submission complete' : 'Partial submission (incomplete)'}
        </div>
      )}
    </div>
  )
}
