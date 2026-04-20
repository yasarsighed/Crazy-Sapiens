import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, ClipboardList, Timer, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// ─── Activity feed from multiple sources ────────────────────────────────────

interface ActivityItem {
  id: string
  type: 'questionnaire' | 'iat' | 'sociogram' | 'alert'
  label: string
  sub: string
  timestamp: string
  color: string
  urgent?: boolean
}

export default async function AuditLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Get studies this researcher owns (or all studies for admin)
  const studiesQuery = supabase.from('studies').select('id, title')
  if (!isAdmin) studiesQuery.eq('created_by', user.id)
  const { data: studies } = await studiesQuery

  const studyIds = (studies ?? []).map((s: any) => s.id)
  const studyTitleMap = Object.fromEntries((studies ?? []).map((s: any) => [s.id, s.title]))

  if (studyIds.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="font-serif text-2xl mb-1">Audit Log</h1>
        <p className="text-sm text-muted-foreground mb-12">Every action. Every time.</p>
        <div className="text-center py-24">
          <p className="font-serif text-xl mb-2">No activity yet.</p>
          <p className="text-sm italic text-muted-foreground">The log is watching. Always.</p>
        </div>
      </div>
    )
  }

  // Collect all activity in parallel
  const [qResultsRes, iatTrialsRes, socSubRes, alertsRes, profilesRes] = await Promise.all([
    // Recent questionnaire completions
    supabase
      .from('questionnaire_scored_results')
      .select('id, participant_id, questionnaire_id, total_score, severity_label, submitted_at, is_complete')
      .eq('is_complete', true)
      .order('submitted_at', { ascending: false })
      .limit(50),

    // Recent IAT sessions (one row per participant per IAT)
    supabase
      .from('iat_trial_log')
      .select('participant_id, iat_id, block_number, created_at')
      .order('created_at', { ascending: false })
      .limit(200),  // grab enough to dedupe by (participant, iat)

    // Recent sociogram submissions
    supabase
      .from('sociogram_participants')
      .select('id, participant_id, sociogram_id, submitted_at, has_submitted')
      .eq('has_submitted', true)
      .order('submitted_at', { ascending: false })
      .limit(50),

    // Clinical alerts (all — not filtered by study since we need to cross-ref)
    supabase
      .from('clinical_alerts_log')
      .select('id, participant_id, questionnaire_id, alert_level, trigger_description, trigger_score, scale_name, acknowledged, created_at, study_id')
      .in('study_id', studyIds)
      .order('created_at', { ascending: false })
      .limit(50),

    // Profiles for all participants
    supabase.from('profiles').select('id, full_name, email'),
  ])

  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p: any) => [p.id, p])
  )

  // Questionnaire instrument titles
  const qIds = [...new Set((qResultsRes.data ?? []).map((r: any) => r.questionnaire_id))]
  const { data: qInstruments } = qIds.length > 0
    ? await supabase.from('questionnaire_instruments').select('id, title, study_id').in('id', qIds)
    : { data: [] }
  const qMap = Object.fromEntries((qInstruments ?? []).map((q: any) => [q.id, q]))

  // IAT instrument titles
  const iatIds = [...new Set((iatTrialsRes.data ?? []).map((r: any) => r.iat_id))]
  const { data: iatInstruments } = iatIds.length > 0
    ? await supabase.from('iat_instruments').select('id, title, study_id').in('id', iatIds)
    : { data: [] }
  const iatMap = Object.fromEntries((iatInstruments ?? []).map((i: any) => [i.id, i]))

  // Sociogram instrument titles
  const socIds = [...new Set((socSubRes.data ?? []).map((r: any) => r.sociogram_id))]
  const { data: socInstruments } = socIds.length > 0
    ? await supabase.from('sociogram_instruments').select('id, title, study_id').in('id', socIds)
    : { data: [] }
  const socMap = Object.fromEntries((socInstruments ?? []).map((s: any) => [s.id, s]))

  // Build unified activity feed — filter to researcher's studies only
  const activity: ActivityItem[] = []

  // Clinical alerts first (highest priority)
  for (const alert of alertsRes.data ?? []) {
    if (!studyIds.includes(alert.study_id)) continue
    const profile = profileMap[alert.participant_id]
    activity.push({
      id: `alert-${alert.id}`,
      type: 'alert',
      label: `Clinical alert — ${alert.scale_name}`,
      sub: `${profile?.full_name ?? 'Unknown'} · Score ${alert.trigger_score} · ${alert.acknowledged ? 'acknowledged' : 'UNACKNOWLEDGED'}`,
      timestamp: alert.created_at,
      color: '#E63946',
      urgent: !alert.acknowledged,
    })
  }

  // Questionnaire completions
  for (const r of qResultsRes.data ?? []) {
    const q = qMap[r.questionnaire_id]
    if (!q || !studyIds.includes(q.study_id)) continue
    const profile = profileMap[r.participant_id]
    activity.push({
      id: `qr-${r.id}`,
      type: 'questionnaire',
      label: `${q.title} submitted`,
      sub: `${profile?.full_name ?? 'Unknown'} · Score ${r.total_score}${r.severity_label ? ' · ' + r.severity_label : ''} · ${studyTitleMap[q.study_id] ?? ''}`,
      timestamp: r.submitted_at,
      color: '#457B9D',
    })
  }

  // IAT completions — deduplicate by (participant_id, iat_id), use earliest created_at
  const iatSeen = new Set<string>()
  for (const t of iatTrialsRes.data ?? []) {
    const key = `${t.participant_id}:${t.iat_id}`
    if (iatSeen.has(key)) continue
    const iat = iatMap[t.iat_id]
    if (!iat || !studyIds.includes(iat.study_id)) continue
    iatSeen.add(key)
    const profile = profileMap[t.participant_id]
    activity.push({
      id: `iat-${key}`,
      type: 'iat',
      label: `${iat.title} completed`,
      sub: `${profile?.full_name ?? 'Unknown'} · ${studyTitleMap[iat.study_id] ?? ''}`,
      timestamp: t.created_at,
      color: '#F4A261',
    })
  }

  // Sociogram submissions
  for (const s of socSubRes.data ?? []) {
    const soc = socMap[s.sociogram_id]
    if (!soc || !studyIds.includes(soc.study_id)) continue
    const profile = profileMap[s.participant_id]
    activity.push({
      id: `soc-${s.id}`,
      type: 'sociogram',
      label: `${soc.title} — nominations submitted`,
      sub: `${profile?.full_name ?? 'Unknown'} · ${studyTitleMap[soc.study_id] ?? ''}`,
      timestamp: s.submitted_at,
      color: '#2D6A4F',
    })
  }

  // Sort newest first
  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const unacknowledgedAlerts = (alertsRes.data ?? []).filter((a: any) => !a.acknowledged && studyIds.includes(a.study_id))

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <h1 className="font-serif text-2xl mb-1">Audit Log</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {activity.length} events across {studyIds.length} {studyIds.length === 1 ? 'study' : 'studies'}
      </p>

      {unacknowledgedAlerts.length > 0 && (
        <div className="flex items-start gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {unacknowledgedAlerts.length} unacknowledged clinical alert{unacknowledgedAlerts.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review each participant's questionnaire results to acknowledge.
            </p>
          </div>
        </div>
      )}

      {activity.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-serif text-xl mb-2">No activity yet.</p>
          <p className="text-sm italic text-muted-foreground">The log is watching. Always.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activity.map(item => {
            const Icon =
              item.type === 'alert' ? AlertTriangle
              : item.type === 'questionnaire' ? ClipboardList
              : item.type === 'iat' ? Timer
              : Users

            return (
              <div
                key={item.id}
                className={`flex items-start gap-4 py-3 border-b border-border last:border-0 ${item.urgent ? 'bg-destructive/3 -mx-2 px-2 rounded-lg' : ''}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: item.color + '20' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.urgent && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        needs review
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-8 italic text-center">
        Showing the last 50 events per category. The log is watching. Always.
      </p>
    </div>
  )
}
