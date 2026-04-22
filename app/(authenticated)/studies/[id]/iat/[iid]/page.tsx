import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, Ban, Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditDebriefButton } from '@/components/edit-debrief-button'
import { mean, sd, cohensD } from '@/lib/questionnaire-psychometrics'

// ─── D-score bands (Greenwald 2003 + Millner 2019) ───────────────────────────
interface DScoreBand {
  label:    string
  short:    string
  min:      number | null   // null = -∞
  max:      number | null   // null = +∞
  color:    string
  clinical: boolean
}

const D_SCORE_BANDS: DScoreBand[] = [
  { label: 'Life association (D < 0)',           short: 'Life assoc.',    min: null,  max: 0,    color: '#52B788', clinical: false },
  { label: 'No clear preference (0 – 0.15)',     short: 'No preference', min: 0,     max: 0.15, color: '#888888', clinical: false },
  { label: 'Slight Self–Death (0.15 – 0.35)',    short: 'Slight',        min: 0.15,  max: 0.35, color: '#E9C46A', clinical: false },
  { label: 'Moderate Self–Death (0.35 – 0.65)',  short: 'Moderate',      min: 0.35,  max: 0.65, color: '#F4A261', clinical: false },
  { label: 'Strong Self–Death (≥ 0.65)',         short: 'Strong ⚑',      min: 0.65,  max: null, color: '#E63946', clinical: true  },
]

function bandFor(d: number): DScoreBand {
  for (const band of D_SCORE_BANDS) {
    if ((band.min === null || d >= band.min) && (band.max === null || d < band.max)) return band
  }
  return D_SCORE_BANDS[D_SCORE_BANDS.length - 1]
}

function fmt(n: number, dp = 3): string { return n.toFixed(dp) }

// ─── Per-participant computed stats ──────────────────────────────────────────
interface ParticipantStats {
  participantId: string
  dScore:        number | null
  trialCount:    number
  meanRT_comp:   number | null   // mean RT for blocks 3+4 (compatible)
  meanRT_incomp: number | null   // mean RT for blocks 6+7 (incompatible)
  errorRate:     number | null   // % of scoring-block trials incorrect
  excluded:      boolean
}

export default async function IATResultsPage({
  params,
}: {
  params: { id: string; iid: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: studyId, iid } = params

  // Fetch instrument
  const { data: instrument } = await supabase
    .from('iat_instruments')
    .select('id, title, description, study_id, debrief_text, created_at')
    .eq('id', iid)
    .single()

  if (!instrument) {
    return <div className="p-6 lg:p-8"><p className="text-muted-foreground">IAT instrument not found.</p></div>
  }

  const { data: study } = await supabase
    .from('studies')
    .select('id, title')
    .eq('id', studyId)
    .single()

  // Fetch D-score session results (assigned_order may not exist — fall back if column missing)
  type SessionRow = { participant_id: string; d_score: number; session_id: string; computed_at: string; assigned_order?: string | null }
  let sessionResults: SessionRow[] | null = null
  let srError: { message: string } | null = null
  {
    const withOrder: { data: unknown; error: { message: string } | null } = await supabase
      .from('iat_session_results')
      .select('participant_id, d_score, session_id, computed_at, assigned_order')
      .eq('iat_id', iid)
      .order('computed_at', { ascending: false })
    if (withOrder.error && /assigned_order/.test(withOrder.error.message)) {
      const fallback: { data: unknown; error: { message: string } | null } = await supabase
        .from('iat_session_results')
        .select('participant_id, d_score, session_id, computed_at')
        .eq('iat_id', iid)
        .order('computed_at', { ascending: false })
      sessionResults = (fallback.data as SessionRow[] | null) ?? null
      srError = fallback.error
    } else {
      sessionResults = (withOrder.data as SessionRow[] | null) ?? null
      srError = withOrder.error
    }
  }

  // Fetch ALL trial data (for RT and error analysis)
  // Note: block_number is the correct column name (not block_num)
  const { data: allTrials } = await supabase
    .from('iat_trial_log')
    .select('participant_id, block_number, response_time_ms, is_correct, excluded_from_scoring')
    .eq('iat_id', iid)

  // Build per-participant trial maps
  const trialsByParticipant: Record<string, typeof allTrials> = {}
  for (const trial of allTrials ?? []) {
    if (!trialsByParticipant[trial.participant_id]) trialsByParticipant[trial.participant_id] = []
    trialsByParticipant[trial.participant_id]!.push(trial)
  }

  // Gather all participant IDs across both tables
  const pidFromSessions = new Set((sessionResults ?? []).map(r => r.participant_id))
  const pidFromTrials   = new Set(Object.keys(trialsByParticipant))
  const allPids = [...new Set([...pidFromSessions, ...pidFromTrials])]

  // D-score by participant (prefer session_results, fall back to null)
  const dScoreByPid: Record<string, number | null> = {}
  for (const r of sessionResults ?? []) dScoreByPid[r.participant_id] = r.d_score
  for (const pid of pidFromTrials) if (!(pid in dScoreByPid)) dScoreByPid[pid] = null

  // Fetch profiles
  const { data: profiles } = allPids.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', allPids)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // Compute per-participant stats
  const participantStats: ParticipantStats[] = allPids.map(pid => {
    const trials = trialsByParticipant[pid] ?? []
    const scoringTrials = trials.filter(t => !t.excluded_from_scoring)
    const compatTrials   = scoringTrials.filter(t => t.block_number === 3 || t.block_number === 4)
    const incompatTrials = scoringTrials.filter(t => t.block_number === 6 || t.block_number === 7)

    const meanRT_comp   = compatTrials.length > 0
      ? mean(compatTrials.map(t => t.response_time_ms).filter(Boolean)) : null
    const meanRT_incomp = incompatTrials.length > 0
      ? mean(incompatTrials.map(t => t.response_time_ms).filter(Boolean)) : null

    const errorCount = scoringTrials.filter(t => !t.is_correct).length
    const errorRate  = scoringTrials.length > 0 ? errorCount / scoringTrials.length : null

    return {
      participantId: pid,
      dScore:        dScoreByPid[pid] ?? null,
      trialCount:    trials.length,
      meanRT_comp,
      meanRT_incomp,
      errorRate,
      excluded:      dScoreByPid[pid] === null,
    }
  })

  // Sort: clinical first, then by D-score descending
  participantStats.sort((a, b) => {
    if (a.dScore !== null && b.dScore !== null) return b.dScore - a.dScore
    if (a.dScore !== null) return -1
    if (b.dScore !== null) return 1
    return 0
  })

  // Aggregate stats
  const validScores = participantStats.map(p => p.dScore).filter((d): d is number => d !== null)
  const clinicalCount = validScores.filter(d => d >= 0.65).length
  const meanD  = validScores.length ? mean(validScores) : null
  const sdD    = validScores.length >= 2 ? sd(validScores) : null
  const minD   = validScores.length ? Math.min(...validScores) : null
  const maxD   = validScores.length ? Math.max(...validScores) : null
  const excluded = participantStats.filter(p => p.excluded).length

  // Percentile helper
  const sortedForPercentile = [...validScores].sort((a, b) => a - b)
  function percentileRank(d: number): number {
    const below = sortedForPercentile.filter(x => x < d).length
    return Math.round((below / sortedForPercentile.length) * 100)
  }

  // Distribution
  const distribution = D_SCORE_BANDS.map(band => ({
    band,
    count: validScores.filter(d =>
      (band.min === null || d >= band.min) && (band.max === null || d < band.max)
    ).length,
  }))

  const hasSessionTable = !srError

  // Counterbalancing breakdown (A vs B block order)
  const orderByPid: Record<string, string | null> = {}
  for (const r of sessionResults ?? []) orderByPid[r.participant_id] = r.assigned_order ?? null
  const scoresA: number[] = []
  const scoresB: number[] = []
  for (const p of participantStats) {
    if (p.dScore === null) continue
    const o = orderByPid[p.participantId]
    if (o === 'A') scoresA.push(p.dScore)
    else if (o === 'B') scoresB.push(p.dScore)
  }
  const hasOrderData = scoresA.length + scoresB.length > 0

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/studies" className="hover:text-foreground">Studies</Link>
        <span>/</span>
        <Link href={`/studies/${studyId}`} className="hover:text-foreground">{study?.title ?? studyId}</Link>
        <span>/</span>
        <span className="text-foreground">{instrument.title}</span>
      </div>

      <Link href={`/studies/${studyId}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to study
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-2 flex-wrap">
          <h1 className="font-serif text-2xl text-foreground">{instrument.title}</h1>
          <Badge variant="outline" className="mt-1 border-[#F4A261] text-[#F4A261]">Death/Suicide IAT</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Implicit Association Test — Self–Death vs. Self–Life associations.
          Algorithm D2 (Greenwald et al., 2003). Clinical threshold D ≥ 0.65 (Millner et al., 2019).
          Positive D = faster Self–Death pairings = stronger implicit Self–Death association.
        </p>
      </div>

      {/* Warnings */}
      {clinicalCount > 0 && (
        <div className="flex items-start gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {clinicalCount} participant{clinicalCount > 1 ? 's' : ''} in the Strong Self–Death band (D ≥ 0.65)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              IAT alone is not diagnostic. Use alongside structured clinical assessment (e.g. Columbia Protocol, SBQ-R).
            </p>
          </div>
        </div>
      )}

      {!hasSessionTable && allPids.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <code className="font-mono">iat_session_results</code> table not found —
            D-scores are not persisted. Create the table and run the SQL migration.
          </p>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Participants', value: allPids.length },
          { label: 'Valid D-scores', value: validScores.length },
          { label: 'Mean D', value: meanD !== null ? fmt(meanD) : '—' },
          { label: 'SD', value: sdD !== null ? fmt(sdD) : '—' },
          { label: 'Clinical ≥ 0.65', value: clinicalCount, red: clinicalCount > 0 },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <p className={`text-2xl font-serif font-semibold ${stat.red ? 'text-destructive' : 'text-foreground'}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasOrderData && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Counterbalancing — D-score by assigned block order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg p-3 border border-muted">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Order A (standard: compatible first)</p>
                <p className="font-serif text-xl">n = {scoresA.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mean D {scoresA.length ? fmt(mean(scoresA)) : '—'} · SD {scoresA.length >= 2 ? fmt(sd(scoresA)) : '—'}
                </p>
              </div>
              <div className="rounded-lg p-3 border border-muted">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Order B (reversed: incompatible first)</p>
                <p className="font-serif text-xl">n = {scoresB.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mean D {scoresB.length ? fmt(mean(scoresB)) : '—'} · SD {scoresB.length >= 2 ? fmt(sd(scoresB)) : '—'}
                </p>
              </div>
            </div>
            {cohensD(scoresA, scoresB) && (() => {
              const eff = cohensD(scoresA, scoresB)!
              const tone = Math.abs(eff.d) < 0.2 ? 'text-[#52B788]' : Math.abs(eff.d) < 0.5 ? 'text-[#E9C46A]' : 'text-destructive'
              const interpretation = Math.abs(eff.d) < 0.2 ? '— negligible order effect'
                : Math.abs(eff.d) < 0.5 ? '— small order effect, monitor'
                : '— substantial order effect, investigate before reporting'
              return (
                <div className="mt-3 text-xs text-muted-foreground">
                  Cohen&apos;s <em>d</em> (A − B) = <span className={`font-mono font-medium ${tone}`}>{fmt(eff.d, 2)}</span>{' '}
                  <span className="font-mono">[95% CI {fmt(eff.ciLow, 2)}, {fmt(eff.ciHigh, 2)}]</span>
                  <span className="ml-2 opacity-80">{interpretation}</span>
                </div>
              )
            })()}

            <p className="text-[11px] text-muted-foreground mt-3">
              Participants are randomly assigned block order at start. D-scores are sign-corrected so both orders share the same interpretation (positive = Self–Death). Large mean differences between A and B may indicate residual order effects.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Interpretation guide */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">D-score interpretation guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
            {D_SCORE_BANDS.map(band => (
              <div key={band.label} className="rounded-lg p-3 border" style={{ borderColor: band.color + '60', backgroundColor: band.color + '12' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: band.color }} />
                  <span className="font-semibold" style={{ color: band.color }}>{band.short.replace(' ⚑', '')}</span>
                  {band.clinical && <span className="text-destructive font-bold">⚑</span>}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{band.label}</p>
                {band.clinical && (
                  <p className="text-[10px] text-destructive mt-1 font-medium">Prioritise clinical follow-up</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Positive D = faster Self–Death associations. These are implicit, automatic preferences — not conscious intent. Always combine with validated self-report (SBQ-R, PHQ-9 item 9) and structured assessment (Columbia Protocol).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* D-score distribution chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">D-score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {validScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No valid D-scores yet.</p>
            ) : (
              <div className="space-y-3">
                {distribution.map(({ band, count }) => {
                  const pct = validScores.length > 0 ? (count / validScores.length) * 100 : 0
                  return (
                    <div key={band.label} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-right">
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: band.color }}
                        >
                          {band.short}
                        </span>
                      </div>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all flex items-center justify-end pr-1"
                          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`, backgroundColor: band.color }}
                        />
                      </div>
                      <div className="w-6 text-xs text-muted-foreground text-right shrink-0">{count}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base">Group summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: 'Mean D-score', value: meanD !== null ? fmt(meanD) : '—', color: meanD !== null ? bandFor(meanD).color : undefined },
              { label: 'SD', value: sdD !== null ? fmt(sdD) : '—' },
              { label: 'Range', value: minD !== null && maxD !== null ? `${fmt(minD)} – ${fmt(maxD)}` : '—' },
              { label: 'Excluded / no D-score', value: excluded > 0 ? `${excluded}` : '0' },
              { label: 'Compatible block mean RT', value: (() => {
                const rts = participantStats.map(p => p.meanRT_comp).filter((r): r is number => r !== null)
                return rts.length ? `${Math.round(mean(rts))} ms` : '—'
              })() },
              { label: 'Incompatible block mean RT', value: (() => {
                const rts = participantStats.map(p => p.meanRT_incomp).filter((r): r is number => r !== null)
                return rts.length ? `${Math.round(mean(rts))} ms` : '—'
              })() },
              { label: 'Group error rate', value: (() => {
                const rates = participantStats.map(p => p.errorRate).filter((r): r is number => r !== null)
                return rates.length ? `${(mean(rates) * 100).toFixed(1)}%` : '—'
              })() },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between border-b border-border last:border-0 pb-2 last:pb-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono font-medium" style={{ color: row.color }}>
                  {row.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Individual results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-base">Individual results</CardTitle>
            {allPids.length > 0 && (
              <p className="text-xs text-muted-foreground">Sorted by D-score descending</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {allPids.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-serif text-lg text-foreground mb-1">No participants yet.</p>
              <p className="text-sm italic text-muted-foreground">The implicit associations await their measurement.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-xs text-muted-foreground font-medium">Participant</th>
                    <th className="text-left py-2 pr-3 text-xs text-muted-foreground font-medium">D-score</th>
                    <th className="text-left py-2 pr-3 text-xs text-muted-foreground font-medium min-w-[140px]">Visual</th>
                    <th className="text-right py-2 pr-3 text-xs text-muted-foreground font-medium">RT (comp.)</th>
                    <th className="text-right py-2 pr-3 text-xs text-muted-foreground font-medium">RT (incomp.)</th>
                    <th className="text-right py-2 pr-3 text-xs text-muted-foreground font-medium">Errors</th>
                    <th className="text-right py-2 pr-3 text-xs text-muted-foreground font-medium">Percentile</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Trials</th>
                  </tr>
                </thead>
                <tbody>
                  {participantStats.map((ps) => {
                    const profile = profileMap[ps.participantId]
                    const band = ps.dScore !== null ? bandFor(ps.dScore) : null
                    // Visual D-score bar: map D ∈ [-2, +2] to 0–100%
                    // Centre line at 50%; 0.65 threshold at 66.25%
                    const barPct = ps.dScore !== null
                      ? Math.min(100, Math.max(0, ((ps.dScore + 2) / 4) * 100))
                      : null

                    return (
                      <tr
                        key={ps.participantId}
                        className={`border-b border-border last:border-0 ${band?.clinical ? 'bg-destructive/5' : ''}`}
                      >
                        <td className="py-3 pr-3">
                          <p className="font-medium text-foreground text-xs">{profile?.full_name ?? 'Unknown'}</p>
                          <p className="text-[11px] text-muted-foreground">{profile?.email ?? ps.participantId.slice(0, 8)}</p>
                        </td>
                        <td className="py-3 pr-3">
                          {ps.dScore !== null ? (
                            <div>
                              <span className="font-serif font-semibold text-base" style={{ color: band?.color }}>
                                {fmt(ps.dScore)}
                              </span>
                              {band && (
                                <span
                                  className="block text-[10px] font-medium mt-0.5 px-1.5 py-px rounded-full w-fit text-white"
                                  style={{ backgroundColor: band.color }}
                                >
                                  {band.short}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs flex items-center gap-1">
                              <Ban className="w-3.5 h-3.5" /> excluded
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {barPct !== null ? (
                            <div className="relative w-full h-4 bg-muted rounded-full overflow-hidden" title={`D = ${fmt(ps.dScore!)}`}>
                              {/* Zero line */}
                              <div className="absolute top-0 bottom-0 w-px bg-border/60" style={{ left: '50%' }} />
                              {/* 0.65 threshold line */}
                              <div className="absolute top-0 bottom-0 w-px bg-destructive/40" style={{ left: '66.25%' }} />
                              {/* D-score marker */}
                              <div
                                className="absolute top-1 bottom-1 w-1.5 rounded-full -translate-x-1/2"
                                style={{ left: `${barPct}%`, backgroundColor: band?.color ?? '#888' }}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <span className="font-mono text-xs text-muted-foreground">
                            {ps.meanRT_comp !== null ? `${Math.round(ps.meanRT_comp)} ms` : '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <span className="font-mono text-xs text-muted-foreground">
                            {ps.meanRT_incomp !== null ? `${Math.round(ps.meanRT_incomp)} ms` : '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <span className={`font-mono text-xs ${ps.errorRate !== null && ps.errorRate > 0.3 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                            {ps.errorRate !== null ? `${(ps.errorRate * 100).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <span className="font-mono text-xs text-muted-foreground">
                            {ps.dScore !== null && validScores.length > 1
                              ? `${percentileRank(ps.dScore)}th`
                              : '—'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            {ps.trialCount}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground">Legend:</span>
                <span className="flex items-center gap-1">
                  <div className="w-px h-3 bg-border" />
                  D = 0 (no preference)
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-px h-3 bg-destructive/40" />
                  D = 0.65 (clinical threshold)
                </span>
                <span>RT (comp.) = mean RT blocks 3+4 (Self+Death paired)</span>
                <span>RT (incomp.) = mean RT blocks 6+7 (Other+Death paired)</span>
                <span className="text-amber-600">Errors &gt; 30% highlighted</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom debrief — preview + inline editor */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base flex items-center justify-between gap-3">
            <span>Participant debrief text</span>
            <EditDebriefButton iatId={iid} initialText={instrument.debrief_text ?? null} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instrument.debrief_text ? (
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {instrument.debrief_text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No custom debrief set. The standard evidence-based debrief will be shown to participants.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Methodological note */}
      <div className="mt-6 p-4 bg-muted/40 rounded-xl">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Algorithm D2 (Greenwald et al., 2003):</strong> RT capped at 10,000 ms.
          Participants excluded if &gt;10% of scoring-block trials &lt; 300 ms.
          Errors penalised as block-pair correct mean + 600 ms.
          Pooled SD from all B3+4+6+7 penalised trials combined.
          D = (Mean<sub>B6+7</sub> − Mean<sub>B3+4</sub>) / Pooled SD.
          Positive D = faster Self–Death pairings.
          Clinical threshold ≥ 0.65 per Millner et al. (2019).
          IAT results supplement — never replace — structured clinical assessment.
        </p>
      </div>

      <p className="text-xs text-muted-foreground mt-4 italic text-center">
        Implicit measures capture what questionnaires cannot. Use both. Trust neither alone.
      </p>
    </div>
  )
}
