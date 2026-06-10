'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts'

// ── Colour helpers ────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  minimal: '#10B981', none: '#10B981',
  mild: '#EAB308',
  moderate: '#F97316',
  'moderately severe': '#DC2626',
  severe: '#DC2626',
}

function severityColor(label: string | null) {
  if (!label) return '#6B6B80'
  const l = label.toLowerCase()
  for (const [k, c] of Object.entries(SEVERITY_COLORS)) if (l.includes(k)) return c
  return '#6D28D9'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QInstrumentStats {
  id: string
  title: string
  scaleName: string | null
  n: number
  completed: number
  mean: number
  sd: number
  min: number
  max: number
  scores: number[]
  severityCounts: { label: string; count: number }[]
}

export interface IatStats {
  id: string
  title: string
  iatType: string | null
  n: number
  completed: number
  dScores: number[]
  mean: number
  sd: number
}

export interface FunnelRow {
  label: string
  enrolled: number
  completed: number
  pct: number
  color: string
}

// ── Histogram helper ──────────────────────────────────────────────────────────

function makeHistogram(scores: number[], bins = 8): { range: string; count: number }[] {
  if (!scores.length) return []
  const min = Math.floor(Math.min(...scores))
  const max = Math.ceil(Math.max(...scores))
  const size = Math.max(1, Math.ceil((max - min) / bins))
  const buckets: { range: string; count: number }[] = []
  for (let lo = min; lo <= max; lo += size) {
    const hi = lo + size
    buckets.push({
      range: `${lo}–${hi - 1}`,
      count: scores.filter(s => s >= lo && s < hi).length,
    })
  }
  return buckets
}

function makeDScoreHistogram(dScores: number[]) {
  const bins = [-2, -1.5, -1, -0.65, -0.35, 0, 0.35, 0.65, 1, 1.5, 2]
  return bins.slice(0, -1).map((lo, i) => {
    const hi = bins[i + 1]
    return {
      range: `${lo.toFixed(1)}`,
      count: dScores.filter(d => d >= lo && d < hi).length,
      fill: lo < -0.35 ? '#0EA5E9' : lo > 0.35 ? '#F97316' : '#6D28D9',
    }
  })
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const HistoTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{payload[0]?.payload?.range}</p>
      <p className="text-muted-foreground">{payload[0]?.value} participants</p>
    </div>
  )
}

const FunnelTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{d?.label}</p>
      <p className="text-muted-foreground">{d?.completed} / {d?.enrolled} completed ({d?.pct}%)</p>
    </div>
  )
}

// ── Questionnaire panel ───────────────────────────────────────────────────────

export function QuestionnaireSummary({ stats }: { stats: QInstrumentStats[] }) {
  if (!stats.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      No questionnaire data collected yet.
    </div>
  )
  return (
    <div className="space-y-8">
      {stats.map(q => {
        const hist = makeHistogram(q.scores, 10)
        const completionPct = q.n > 0 ? Math.round((q.completed / q.n) * 100) : 0
        return (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-serif text-[15px] font-semibold text-foreground">{q.title}</h3>
                {q.scaleName && (
                  <span className="text-[11px] text-muted-foreground">{q.scaleName}</span>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-serif font-bold tabular-nums" style={{ color: '#6D28D9' }}>
                  {completionPct}%
                </p>
                <p className="text-[10px] text-muted-foreground">{q.completed}/{q.n} complete</p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'n', value: q.completed, color: '#6D28D9' },
                { label: 'Mean', value: q.mean.toFixed(1), color: '#0EA5E9' },
                { label: 'SD', value: q.sd.toFixed(1), color: '#F97316' },
                { label: 'Range', value: `${q.min}–${q.max}`, color: '#10B981' },
              ].map(s => (
                <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-serif font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {q.scores.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Score distribution */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Score Distribution</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={hist} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <RTooltip content={<HistoTooltip />} />
                      <ReferenceLine
                        x={hist.find(b => {
                          const lo = parseFloat(b.range.split('–')[0])
                          return lo <= q.mean && lo + 1 > q.mean
                        })?.range ?? ''}
                        stroke="#6D28D9" strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: 'M', position: 'top', fontSize: 9, fill: '#6D28D9' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {hist.map((_, i) => (
                          <Cell key={i} fill={i % 2 === 0 ? '#6D28D9' : '#8B5CF6'} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Severity breakdown */}
                {q.severityCounts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Severity Bands</p>
                    <div className="space-y-2 mt-1">
                      {q.severityCounts.map(sv => {
                        const pct = q.completed > 0 ? Math.round((sv.count / q.completed) * 100) : 0
                        const color = severityColor(sv.label)
                        return (
                          <div key={sv.label} className="flex items-center gap-2">
                            <span className="w-20 text-[11px] text-foreground font-medium truncate capitalize">{sv.label}</span>
                            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                            <span className="w-12 text-right text-[11px] font-semibold tabular-nums" style={{ color }}>
                              {sv.count} <span className="text-muted-foreground font-normal">({pct}%)</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {q.scores.length < 3 && (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                Not enough data yet for distribution chart (need ≥ 3 responses).
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── IAT panel ─────────────────────────────────────────────────────────────────

export function IatSummary({ stats }: { stats: IatStats[] }) {
  if (!stats.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      No IAT data collected yet.
    </div>
  )
  return (
    <div className="space-y-8">
      {stats.map(iat => {
        const hist = makeDScoreHistogram(iat.dScores)
        const completionPct = iat.n > 0 ? Math.round((iat.completed / iat.n) * 100) : 0
        const strongPref = iat.dScores.filter(d => Math.abs(d) >= 0.65).length
        const modPref    = iat.dScores.filter(d => Math.abs(d) >= 0.35 && Math.abs(d) < 0.65).length
        const slightPref = iat.dScores.filter(d => Math.abs(d) > 0 && Math.abs(d) < 0.35).length
        const neutral    = iat.dScores.filter(d => d === 0).length

        return (
          <div key={iat.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-serif text-[15px] font-semibold text-foreground">{iat.title}</h3>
                {iat.iatType && (
                  <span className="text-[11px] text-muted-foreground capitalize">{iat.iatType.replace(/_/g, ' ')}</span>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-serif font-bold tabular-nums text-amber-500">{completionPct}%</p>
                <p className="text-[10px] text-muted-foreground">{iat.completed}/{iat.n} complete</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'n', value: iat.completed, color: '#F97316' },
                { label: 'Mean D', value: iat.mean.toFixed(3), color: Math.abs(iat.mean) > 0.35 ? '#DC2626' : '#10B981' },
                { label: 'SD', value: iat.sd.toFixed(3), color: '#0EA5E9' },
                { label: 'Strong pref', value: `${strongPref} (${iat.completed ? Math.round(strongPref / iat.completed * 100) : 0}%)`, color: '#DC2626' },
              ].map(s => (
                <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-serif font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {iat.dScores.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">D-score Distribution</p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    ← Implicit preference for B &nbsp;·&nbsp; 0 = no preference &nbsp;·&nbsp; Implicit preference for A →
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={hist} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 8, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <RTooltip content={<HistoTooltip />} />
                      <ReferenceLine x="0.0" stroke="var(--foreground)" strokeDasharray="3 2" strokeWidth={1} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {hist.map((h, i) => (
                          <Cell key={i} fill={h.fill} fillOpacity={0.75} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preference Strength</p>
                  <div className="space-y-2 mt-1">
                    {[
                      { label: 'Strong preference (|D| ≥ 0.65)', count: strongPref, color: '#DC2626' },
                      { label: 'Moderate (0.35 ≤ |D| < 0.65)', count: modPref, color: '#F97316' },
                      { label: 'Slight (0 < |D| < 0.35)', count: slightPref, color: '#EAB308' },
                      { label: 'No preference (D ≈ 0)', count: neutral, color: '#10B981' },
                    ].map(row => {
                      const pct = iat.completed > 0 ? Math.round((row.count / iat.completed) * 100) : 0
                      return (
                        <div key={row.label} className="flex items-center gap-2">
                          <span className="w-36 text-[10px] text-foreground truncate">{row.label}</span>
                          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                          </div>
                          <span className="w-10 text-right text-[11px] font-semibold tabular-nums" style={{ color: row.color }}>
                            {row.count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Completion funnel ─────────────────────────────────────────────────────────

export function CompletionFunnel({ rows }: { rows: FunnelRow[] }) {
  if (!rows.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      No instruments in this study yet.
    </div>
  )
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground truncate">{r.label}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                />
              </div>
              <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: r.color }}>
                {r.pct}%
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-serif font-bold tabular-nums" style={{ color: r.color }}>{r.completed}</p>
            <p className="text-[10px] text-muted-foreground">of {r.enrolled} enrolled</p>
          </div>
        </div>
      ))}
    </div>
  )
}
