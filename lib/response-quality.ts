// Response-quality heuristics for questionnaire item responses.
// Pure functions — no DB. Given a participant's raw responses (in item order),
// return flags the researcher can use to exclude or weight the case.

export interface ResponseRow {
  participant_id: string
  item_id:        string
  raw_response_numeric: number | null
  scored_value:   number
  submitted_at?:  string | null      // ISO timestamp of when this item was last answered
}

export interface QualityFlags {
  straightLining:    boolean   // same response for ≥ threshold consecutive items
  longestRun:        number    // length of longest constant-response run
  completionSeconds: number | null   // seconds between first and last item submitted
  tooFast:           boolean   // completion faster than minSecondsPerItem * nItems
  invariant:         boolean   // zero variance across all items (answered everything identically)
}

// Minimum plausible time per item, in seconds. 1.2s is conservative — most
// validated scales were written assuming 3–10s/item reading time.
const MIN_SECONDS_PER_ITEM = 1.2

// Flag straight-lining if ≥ 60% of items are in one constant run.
const STRAIGHT_LINE_MIN_RUN_FRACTION = 0.6

export function assessParticipantQuality(rows: ResponseRow[]): QualityFlags {
  if (rows.length === 0) {
    return { straightLining: false, longestRun: 0, completionSeconds: null, tooFast: false, invariant: false }
  }

  // Longest constant-response run
  let longestRun = 1
  let currentRun = 1
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].raw_response_numeric === rows[i - 1].raw_response_numeric) {
      currentRun++
      if (currentRun > longestRun) longestRun = currentRun
    } else {
      currentRun = 1
    }
  }
  const straightLining = longestRun / rows.length >= STRAIGHT_LINE_MIN_RUN_FRACTION && rows.length >= 5

  // Invariant = literally every answer the same
  const uniqueValues = new Set(rows.map(r => r.raw_response_numeric))
  const invariant = uniqueValues.size === 1

  // Completion time from timestamps (if available)
  const times = rows.map(r => r.submitted_at ? new Date(r.submitted_at).getTime() : null).filter((t): t is number => t !== null)
  let completionSeconds: number | null = null
  let tooFast = false
  if (times.length >= 2) {
    const span = Math.max(...times) - Math.min(...times)
    completionSeconds = span / 1000
    tooFast = completionSeconds < MIN_SECONDS_PER_ITEM * rows.length
  }

  return { straightLining, longestRun, completionSeconds, tooFast, invariant }
}

export function qualityLabel(q: QualityFlags): { label: string; color: string; severity: 'ok' | 'caution' | 'exclude' } {
  if (q.invariant)      return { label: 'Invariant (all same)', color: '#E63946', severity: 'exclude' }
  if (q.straightLining) return { label: 'Straight-lining',      color: '#E76F51', severity: 'exclude' }
  if (q.tooFast)        return { label: 'Too fast',             color: '#F4A261', severity: 'caution' }
  return                       { label: 'OK',                   color: '#52B788', severity: 'ok' }
}
