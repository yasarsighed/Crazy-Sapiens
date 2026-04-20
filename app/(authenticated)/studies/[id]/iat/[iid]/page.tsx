import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Ban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ─── D-score interpretation bands (Greenwald 2003 + Millner 2019) ────────────
interface DScoreBand {
  label: string
  min: number | null   // null = -∞
  max: number | null   // null = +∞
  color: string
  clinical: boolean
}

const D_SCORE_BANDS: DScoreBand[] = [
  { label: 'Life association (D < 0)',      min: null, max: 0,    color: '#52B788', clinical: false },
  { label: 'No preference (0 – 0.15)',      min: 0,    max: 0.15, color: '#888888', clinical: false },
  { label: 'Slight Self–Death (0.15 – 0.35)', min: 0.15, max: 0.35, color: '#E9C46A', clinical: false },
  { label: 'Moderate Self–Death (0.35 – 0.65)', min: 0.35, max: 0.65, color: '#F4A261', clinical: false },
  { label: 'Strong Self–Death (≥ 0.65)',    min: 0.65, max: null, color: '#E63946', clinical: true },
]

function bandForScore(d: number): DScoreBand {
  for (const band of D_SCORE_BANDS) {
    const aboveMin = band.min === null || d >= band.min
    const belowMax = band.max === null || d < band.max
    if (aboveMin && belowMax) return band
  }
  return D_SCORE_BANDS[D_SCORE_BANDS.length - 1]
}

function buildDDistribution(
  scores: number[]
): { band: DScoreBand; count: number }[] {
  return D_SCORE_BANDS.map(band => ({
    band,
    count: scores.filter(d => {
      const aboveMin = band.min === null || d >= band.min
      const belowMax = band.max === null || d < band.max
      return aboveMin && belowMax
    }).length,
  }))
}

function dScoreLabel(d: number): string {
  return bandForScore(d).label
}

// ─── Stats helpers ────────────────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
function sd(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

export default async function IATResultsPage({
  params,
}: {
  params: { id: string; iid: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: studyId, iid } = params

  // Fetch IAT instrument details
  const { data: instrument } = await supabase
    .from('iat_instruments')
    .select('id, title, description, study_id, created_at')
    .eq('id', iid)
    .single()

  if (!instrument) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">IAT instrument not found.</p>
      </div>
    )
  }

  // Fetch study for breadcrumb
  const { data: study } = await supabase
    .from('studies')
    .select('id, title')
    .eq('id', studyId)
    .single()

  // Fetch D-score session results
  // Falls back gracefully if iat_session_results doesn't exist
  const { data: sessionResults, error: srError } = await supabase
    .from('iat_session_results')
    .select('participant_id, d_score, session_id, computed_at')
    .eq('iat_id', iid)
    .order('computed_at', { ascending: false })

  const hasResultsTable = !srError

  // Fetch trial log counts per participant (to know who attempted even if D-score not saved)
  const { data: trialCounts } = await supabase
    .from('iat_trial_log')
    .select('participant_id, block_num')
    .eq('iat_id', iid)

  // Unique participants who have trial data
  const participantIdsFromTrials = [...new Set((trialCounts ?? []).map((t: any) => t.participant_id))]
  const participantIdsFromScores = [...new Set((sessionResults ?? []).map((r: any) => r.participant_id))]
  const allParticipantIds = [...new Set([...participantIdsFromTrials, ...participantIdsFromScores])]

  // Fetch profiles
  const { data: profiles } = allParticipantIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', allParticipantIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

  // Trial counts per participant (for "% blocks completed" indicator)
  const trialCountMap: Record<string, number> = {}
  for (const t of trialCounts ?? []) {
    trialCountMap[t.participant_id] = (trialCountMap[t.participant_id] ?? 0) + 1
  }

  // Build unified participant list
  // Prefer session_results for D-score; fall back to "completed but D-score not saved"
  const scoreByParticipant: Record<string, number | null> = {}
  for (const r of sessionResults ?? []) {
    scoreByParticipant[r.participant_id] = r.d_score
  }

  // Anyone in trials but not in scores = attempted but D-score not persisted
  for (const pid of participantIdsFromTrials) {
    if (!(pid in scoreByParticipant)) {
      scoreByParticipant[pid] = null
    }
  }

  // Stats on valid D-scores only
  const validScores = Object.values(scoreByParticipant).filter((s): s is number => s !== null)
  const excluded = allParticipantIds.length - validScores.length

  const meanD   = validScores.length ? mean(validScores).toFixed(3) : null
  const sdD     = validScores.length >= 2 ? sd(validScores).toFixed(3) : null
  const maxD    = validScores.length ? Math.max(...validScores).toFixed(3) : null
  const minD    = validScores.length ? Math.min(...validScores).toFixed(3) : null

  const distribution = buildDDistribution(validScores)
  const clinicalCount = validScores.filter(d => d >= 0.65).length

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/studies" className="hover:text-foreground">Studies</Link>
        <span>/</span>
        <Link href={`/studies/${studyId}`} className="hover:text-foreground">{study?.title ?? studyId}</Link>
        <span>/</span>
        <span className="text-foreground">{instrument.title}</span>
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
          <h1 className="font-serif text-2xl text-foreground">{instrument.title}</h1>
          <Badge variant="outline" className="mt-1 border-[#F4A261] text-[#F4A261]">
            Death/Suicide IAT
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Implicit Association Test measuring Self–Death vs. Self–Life associations.
          D-scores computed via Greenwald et al. (2003) Algorithm D2.
          Positive D = faster Self–Death pairings; clinical threshold ≥ 0.65 (Millner et al. 2019).
        </p>
      </div>

      {/* Clinical alert banner */}
      {clinicalCount > 0 && (
        <div className="flex items-start gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {clinicalCount} participant{clinicalCount > 1 ? 's' : ''} scored ≥ 0.65 (Strong Self–Death association)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These participants show implicit associations that may warrant clinical follow-up.
              IAT alone is not diagnostic — use alongside validated clinical screening.
            </p>
          </div>
        </div>
      )}

      {/* Missing iat_session_results table warning */}
      {!hasResultsTable && allParticipantIds.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">D-scores not persisted</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The <code className="font-mono">iat_session_results</code> table does not exist yet.
              D-scores are computed client-side on each participant's session but not stored.
              Create the table to enable persistent aggregate analytics.
            </p>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{allParticipantIds.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Participants attempted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{meanD ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Mean D-score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{sdD ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">SD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-serif font-semibold text-foreground">{excluded}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Excluded / no D-score</p>
          </CardContent>
        </Card>
      </div>

      {/* D-score scale reference */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">D-score reference scale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {distribution.map(({ band, count }) => {
              const pct = validScores.length > 0 ? (count / validScores.length) * 100 : 0
              return (
                <div key={band.label} className="flex items-center gap-3">
                  <div className="w-52 shrink-0 text-xs text-muted-foreground text-right">{band.label}</div>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: band.color }}
                    />
                  </div>
                  <div className="w-8 text-xs text-muted-foreground text-right">{count}</div>
                  {band.clinical && count > 0 && (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic">
            Range labels adapted from Greenwald et al. (2003) general thresholds and Millner et al. (2019)
            clinical threshold for the Death/Suicide IAT.
          </p>
        </CardContent>
      </Card>

      {/* Individual results table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Individual results</CardTitle>
        </CardHeader>
        <CardContent>
          {allParticipantIds.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-serif text-lg text-foreground mb-1">No participants yet.</p>
              <p className="text-sm italic text-muted-foreground">The implicit associations await their measurement.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Participant</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">D-score</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Interpretation</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Trials</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Clinical flag</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(scoreByParticipant).map(([pid, dScore], i) => {
                    const profile = profileMap[pid]
                    const trials  = trialCountMap[pid] ?? 0
                    const band    = dScore !== null ? bandForScore(dScore) : null

                    return (
                      <tr
                        key={`${pid}-${i}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium text-foreground">
                            {profile?.full_name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">{profile?.email ?? pid}</p>
                        </td>
                        <td className="py-3 pr-4">
                          {dScore !== null ? (
                            <span
                              className="font-serif text-lg font-semibold"
                              style={{ color: band?.color ?? '#888888' }}
                            >
                              {dScore.toFixed(3)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm flex items-center gap-1">
                              <Ban className="w-3.5 h-3.5" />
                              excluded
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {band ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: band.color }}
                            >
                              {band.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {trials} trials
                          </span>
                        </td>
                        <td className="py-3">
                          {band?.clinical ? (
                            <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Review
                            </span>
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-[#52B788]" />
                          )}
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

      {/* Methodological note */}
      <div className="mt-6 p-4 bg-muted/40 rounded-xl">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Methodological note:</strong> D-scores range from approximately −2 to +2.
          A positive D indicates faster (more implicit) Self–Death pairings relative to Self–Life pairings.
          Algorithm D2: RT capped at 10,000 ms; participants excluded if {'>'}10% of trials {'<'} 300 ms;
          errors penalised as block-pair mean + 600 ms; pooled SD from all scoring blocks combined.
          The ≥ 0.65 clinical threshold follows Millner et al. (2019) — IAT results should supplement,
          not replace, structured clinical assessment.
        </p>
      </div>

      <p className="text-xs text-muted-foreground mt-4 italic text-center">
        Implicit measures capture what questionnaires cannot. Use both. Trust neither alone.
      </p>
    </div>
  )
}
