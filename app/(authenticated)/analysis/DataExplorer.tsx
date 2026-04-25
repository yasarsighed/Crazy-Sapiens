'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Users, BarChart3, Timer } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParticipantProfile {
  id: string
  full_name: string | null
  gender: string | null
  date_of_birth: string | null
  education_level: string | null
  occupation: string | null
}

export interface QResult {
  participant_id: string
  questionnaire_id: string
  total_score: number | null
  severity_label: string | null
}

export interface IATResult {
  participant_id: string
  iat_id: string
  d_score: number | null
}

export interface QInstrument {
  id: string
  title: string
  validated_scale_name: string | null
  study_id: string
}

export interface IATInstrument {
  id: string
  title: string
  iat_type: string | null
  study_id: string
}

export interface Study {
  id: string
  title: string
}

export interface Enrollment {
  study_id: string
  participant_id: string
}

interface Props {
  studies: Study[]
  participants: ParticipantProfile[]
  qResults: QResult[]
  qInstruments: QInstrument[]
  iatResults: IATResult[]
  iatInstruments: IATInstrument[]
  enrollments: Enrollment[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  '#4ECDC4', '#FF6B6B', '#95D5B2', '#E9C46A',
  '#A8DADC', '#F4A261', '#C77DFF', '#FFD166',
]

const GROUP_BY_OPTIONS = [
  { value: 'none',            label: 'No grouping (all participants)' },
  { value: 'gender',          label: 'Gender' },
  { value: 'age_group',       label: 'Age group' },
  { value: 'occupation',      label: 'Position / role' },
  { value: 'education_level', label: 'Education level' },
] as const

type GroupByKey = (typeof GROUP_BY_OPTIONS)[number]['value']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function sd(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function getAgeGroup(dob: string | null): string {
  if (!dob) return 'Unknown'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
  if (age < 23) return 'Under 23'
  if (age < 27) return '23–26'
  if (age < 31) return '27–30'
  if (age < 40) return '31–39'
  return '40+'
}

function getGroupValue(p: ParticipantProfile, key: GroupByKey): string {
  switch (key) {
    case 'gender':          return p.gender          || 'Not specified'
    case 'age_group':       return getAgeGroup(p.date_of_birth)
    case 'occupation':      return p.occupation       || 'Not specified'
    case 'education_level': return p.education_level  || 'Not specified'
    default:                return 'All participants'
  }
}

function colorForGroup(groups: string[], group: string): string {
  const idx = groups.indexOf(group)
  return GROUP_COLORS[idx % GROUP_COLORS.length]
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg p-3 text-xs shadow-lg min-w-[120px]">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground">
            {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Mini chart card ──────────────────────────────────────────────────────────

interface InstrumentChartProps {
  title: string
  abbrev: string | null
  chartData: { group: string; mean: number; n: number }[]
  groups: string[]
  isIAT?: boolean
  totalN: number
  overallMean: number
  overallSd: number
  groupBy: GroupByKey
}

function InstrumentChart({
  title, abbrev, chartData, groups, isIAT, totalN, overallMean, overallSd, groupBy,
}: InstrumentChartProps) {
  const maxVal = Math.max(...chartData.map(d => d.mean), isIAT ? 1.0 : 1)
  const minVal = isIAT ? Math.min(-0.3, ...chartData.map(d => d.mean)) : 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-serif text-sm leading-snug text-foreground">
            {title}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {abbrev && (
              <Badge variant="outline" className="text-[10px] font-mono">{abbrev}</Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">n={totalN}</Badge>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Overall: <span className="font-mono text-foreground">{overallMean.toFixed(2)}</span>
          {' '}± <span className="font-mono text-foreground">{overallSd.toFixed(2)}</span>
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0 flex-1">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="group"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[minVal, maxVal * 1.15]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
            />
            <Tooltip content={<CustomTooltip />} />
            {isIAT && (
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />
            )}
            <Bar dataKey="mean" radius={[3, 3, 0, 0]} maxBarSize={48}>
              {chartData.map(entry => (
                <Cell
                  key={entry.group}
                  fill={colorForGroup(groups, entry.group)}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Per-group stats */}
        {groupBy !== 'none' && (
          <div className="mt-2 space-y-0.5 px-2">
            {chartData.map(d => (
              <div key={d.group} className="flex items-center gap-1.5 text-[10px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: colorForGroup(groups, d.group) }}
                />
                <span className="text-muted-foreground truncate flex-1">{d.group}</span>
                <span className="font-mono text-foreground">{d.mean.toFixed(2)}</span>
                <span className="text-muted-foreground">(n={d.n})</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DataExplorer({
  studies, participants, qResults, qInstruments,
  iatResults, iatInstruments, enrollments,
}: Props) {
  const [selectedStudyId, setSelectedStudyId] = useState<string>('all')
  const [groupBy, setGroupBy]                 = useState<GroupByKey>('none')

  // ── Derive active scope ──────────────────────────────────────────────────
  const activeStudyIds = useMemo(() =>
    selectedStudyId === 'all' ? studies.map(s => s.id) : [selectedStudyId],
    [selectedStudyId, studies]
  )

  const activeParticipantIds = useMemo(() => new Set(
    enrollments.filter(e => activeStudyIds.includes(e.study_id)).map(e => e.participant_id)
  ), [enrollments, activeStudyIds])

  const activeQIds  = useMemo(() =>
    new Set(qInstruments.filter(q  => activeStudyIds.includes(q.study_id)).map(q => q.id)),
    [qInstruments, activeStudyIds]
  )
  const activeIatIds = useMemo(() =>
    new Set(iatInstruments.filter(i => activeStudyIds.includes(i.study_id)).map(i => i.id)),
    [iatInstruments, activeStudyIds]
  )

  const activeParticipants = useMemo(() =>
    participants.filter(p => activeParticipantIds.has(p.id)),
    [participants, activeParticipantIds]
  )

  // ── Groups ───────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (groupBy === 'none') return ['All participants']
    const vals = new Set(activeParticipants.map(p => getGroupValue(p, groupBy)))
    return Array.from(vals).sort()
  }, [activeParticipants, groupBy])

  function participantsInGroup(group: string): Set<string> {
    if (groupBy === 'none') return activeParticipantIds
    return new Set(
      activeParticipants.filter(p => getGroupValue(p, groupBy) === group).map(p => p.id)
    )
  }

  // ── Questionnaire chart data ──────────────────────────────────────────────
  const qChartData = useMemo(() =>
    qInstruments
      .filter(q => activeQIds.has(q.id))
      .map(q => {
        const results = qResults.filter(
          r => r.questionnaire_id === q.id &&
               activeParticipantIds.has(r.participant_id) &&
               r.total_score !== null
        )
        const allScores = results.map(r => r.total_score as number)

        const chartData = groups.map(g => {
          const gPids = participantsInGroup(g)
          const scores = results.filter(r => gPids.has(r.participant_id)).map(r => r.total_score as number)
          return { group: g, mean: parseFloat(mean(scores).toFixed(3)), n: scores.length }
        })

        return {
          instrument: q,
          chartData,
          totalN:      allScores.length,
          overallMean: mean(allScores),
          overallSd:   sd(allScores),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qInstruments, qResults, activeQIds, activeParticipantIds, groups, groupBy]
  )

  // ── IAT chart data ────────────────────────────────────────────────────────
  const iatChartData = useMemo(() =>
    iatInstruments
      .filter(i => activeIatIds.has(i.id))
      .map(i => {
        const results = iatResults.filter(
          r => r.iat_id === i.id &&
               activeParticipantIds.has(r.participant_id) &&
               r.d_score !== null
        )
        const allScores = results.map(r => r.d_score as number)

        const chartData = groups.map(g => {
          const gPids = participantsInGroup(g)
          const scores = results.filter(r => gPids.has(r.participant_id)).map(r => r.d_score as number)
          return { group: g, mean: parseFloat(mean(scores).toFixed(4)), n: scores.length }
        })

        return {
          instrument: i,
          chartData,
          totalN:      allScores.length,
          overallMean: mean(allScores),
          overallSd:   sd(allScores),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [iatInstruments, iatResults, activeIatIds, activeParticipantIds, groups, groupBy]
  )

  // ── Summary table data ────────────────────────────────────────────────────
  const tableRows = useMemo(() => groups.map(group => {
    const gPids = participantsInGroup(group)

    const qCols = qInstruments.filter(q => activeQIds.has(q.id)).map(q => {
      const scores = qResults
        .filter(r => r.questionnaire_id === q.id && gPids.has(r.participant_id) && r.total_score !== null)
        .map(r => r.total_score as number)
      return { id: q.id, mean: mean(scores), sd: sd(scores), n: scores.length }
    })

    const iatCols = iatInstruments.filter(i => activeIatIds.has(i.id)).map(i => {
      const scores = iatResults
        .filter(r => r.iat_id === i.id && gPids.has(r.participant_id) && r.d_score !== null)
        .map(r => r.d_score as number)
      return { id: i.id, mean: mean(scores), sd: sd(scores), n: scores.length }
    })

    return { group, n: gPids.size, qCols, iatCols }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [groups, groupBy, qInstruments, iatInstruments, qResults, iatResults, activeQIds, activeIatIds, activeParticipantIds])

  const activeGroupByLabel = GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label ?? ''

  return (
    <div className="p-6 lg:p-8 max-w-screen-xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1">Data Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Compare all measures across any participant variable. Pick a grouping and the charts update instantly.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-muted/30 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Study</span>
          <Select value={selectedStudyId} onValueChange={setSelectedStudyId}>
            <SelectTrigger className="h-8 text-xs w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All studies</SelectItem>
              {studies.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Group by</span>
          <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupByKey)}>
            <SelectTrigger className="h-8 text-xs w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active summary */}
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary" className="text-xs gap-1.5">
            <Users className="w-3 h-3" />
            {activeParticipantIds.size} participants
          </Badge>
          {groupBy !== 'none' && (
            <Badge variant="outline" className="text-xs">
              {groups.length} {activeGroupByLabel.toLowerCase()} group{groups.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Group legend */}
      {groupBy !== 'none' && groups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {groups.map(g => (
            <div key={g} className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-full px-3 py-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorForGroup(groups, g) }} />
              <span className="text-foreground font-medium">{g}</span>
            </div>
          ))}
        </div>
      )}

      {/* Questionnaire section */}
      {qChartData.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-serif text-lg">Questionnaire scores</h2>
            <span className="text-xs text-muted-foreground">(mean total score per group)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {qChartData.map(({ instrument, chartData, totalN, overallMean, overallSd }) => (
              <InstrumentChart
                key={instrument.id}
                title={instrument.title}
                abbrev={instrument.validated_scale_name}
                chartData={chartData}
                groups={groups}
                totalN={totalN}
                overallMean={overallMean}
                overallSd={overallSd}
                groupBy={groupBy}
              />
            ))}
          </div>
        </section>
      )}

      {/* IAT section */}
      {iatChartData.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-serif text-lg">IAT D-scores</h2>
            <span className="text-xs text-muted-foreground">(mean D-score · dashed line = 0)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {iatChartData.map(({ instrument, chartData, totalN, overallMean, overallSd }) => (
              <InstrumentChart
                key={instrument.id}
                title={instrument.title}
                abbrev={instrument.iat_type}
                chartData={chartData}
                groups={groups}
                isIAT
                totalN={totalN}
                overallMean={overallMean}
                overallSd={overallSd}
                groupBy={groupBy}
              />
            ))}
          </div>
        </section>
      )}

      {/* Summary table */}
      {(qChartData.length > 0 || iatChartData.length > 0) && (
        <section>
          <h2 className="font-serif text-lg mb-4">Summary table</h2>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0 bg-muted/30 min-w-[120px]">
                      {groupBy === 'none' ? 'All' : activeGroupByLabel}
                    </th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">n</th>
                    {qChartData.map(({ instrument }) => (
                      <th key={instrument.id} className="text-right py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">
                        {instrument.validated_scale_name ?? instrument.title}
                      </th>
                    ))}
                    {iatChartData.map(({ instrument }) => (
                      <th key={instrument.id} className="text-right py-3 px-3 font-medium text-muted-foreground whitespace-nowrap">
                        {instrument.iat_type ?? instrument.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(row => (
                    <tr key={row.group} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground sticky left-0 bg-background">
                        <div className="flex items-center gap-2">
                          {groupBy !== 'none' && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: colorForGroup(groups, row.group) }}
                            />
                          )}
                          {row.group}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">{row.n}</td>
                      {row.qCols.map(col => (
                        <td key={col.id} className="py-3 px-3 text-right font-mono">
                          {col.n > 0
                            ? <><span className="text-foreground">{col.mean.toFixed(1)}</span><span className="text-muted-foreground"> ±{col.sd.toFixed(1)}</span></>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                      ))}
                      {row.iatCols.map(col => (
                        <td key={col.id} className="py-3 px-3 text-right font-mono">
                          {col.n > 0
                            ? <><span className="text-foreground">{col.mean.toFixed(3)}</span><span className="text-muted-foreground"> ±{col.sd.toFixed(3)}</span></>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-[11px] text-muted-foreground mt-3 italic text-center">
            M ± SD shown. Significant does not mean important — always compute effect sizes.
          </p>
        </section>
      )}

      {qChartData.length === 0 && iatChartData.length === 0 && (
        <div className="text-center py-24">
          <BarChart3 className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
          <p className="font-serif text-xl mb-2">No data yet.</p>
          <p className="text-sm text-muted-foreground">
            Collect questionnaire and IAT responses to see comparisons here.
          </p>
        </div>
      )}
    </div>
  )
}
