// Questionnaire psychometric analysis — pure functions.
// Input is a participants-by-items matrix of scored values.

type Matrix = number[][] // rows = participants, cols = items (order matches itemIds)

// ─── Descriptive stats ────────────────────────────────────────────────────────

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function variance(xs: number[], sample = true): number {
  const n = xs.length
  if (n < 2) return 0
  const m = mean(xs)
  const ss = xs.reduce((s, x) => s + (x - m) ** 2, 0)
  return ss / (sample ? n - 1 : n)
}

export function sd(xs: number[], sample = true): number {
  return Math.sqrt(variance(xs, sample))
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

// Fisher-Pearson skewness (moment-based) — sample-adjusted
export function skewness(xs: number[]): number {
  const n = xs.length
  if (n < 3) return 0
  const m = mean(xs)
  const s = sd(xs)
  if (s === 0) return 0
  const sum3 = xs.reduce((a, x) => a + ((x - m) / s) ** 3, 0)
  return (n / ((n - 1) * (n - 2))) * sum3
}

// Excess kurtosis (0 = normal distribution)
export function kurtosis(xs: number[]): number {
  const n = xs.length
  if (n < 4) return 0
  const m = mean(xs)
  const s = sd(xs)
  if (s === 0) return 0
  const sum4 = xs.reduce((a, x) => a + ((x - m) / s) ** 4, 0)
  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))
  const term2 = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
  return term1 * sum4 - term2
}

// ─── Pearson correlation ──────────────────────────────────────────────────────

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = mean(x.slice(0, n))
  const my = mean(y.slice(0, n))
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

// ─── Cronbach's alpha ─────────────────────────────────────────────────────────
// α = (k/(k-1)) * (1 - Σvar(item_i) / var(total))
// Requires at least 2 items and 2 participants with full data.

export function cronbachAlpha(matrix: Matrix): number {
  const n = matrix.length
  if (n < 2) return NaN
  const k = matrix[0]?.length ?? 0
  if (k < 2) return NaN

  const itemScores: number[][] = Array.from({ length: k }, () => [])
  const totals: number[] = []
  for (const row of matrix) {
    if (row.length !== k) return NaN
    let t = 0
    for (let j = 0; j < k; j++) {
      itemScores[j].push(row[j])
      t += row[j]
    }
    totals.push(t)
  }

  const sumItemVar = itemScores.reduce((s, v) => s + variance(v), 0)
  const totalVar = variance(totals)
  if (totalVar === 0) return 0
  return (k / (k - 1)) * (1 - sumItemVar / totalVar)
}

// ─── Item-total correlation (corrected: item excluded from total) ─────────────

export function itemTotalCorrelations(matrix: Matrix): number[] {
  const n = matrix.length
  const k = matrix[0]?.length ?? 0
  if (n < 2 || k < 2) return new Array(k).fill(NaN)

  const out: number[] = []
  for (let j = 0; j < k; j++) {
    const itemVals = matrix.map(row => row[j])
    const restTotals = matrix.map(row => row.reduce((s, v, i) => i === j ? s : s + v, 0))
    out.push(pearson(itemVals, restTotals))
  }
  return out
}

// ─── Alpha-if-item-deleted ────────────────────────────────────────────────────

export function alphaIfItemDeleted(matrix: Matrix): number[] {
  const k = matrix[0]?.length ?? 0
  const out: number[] = []
  for (let j = 0; j < k; j++) {
    const reduced = matrix.map(row => row.filter((_, i) => i !== j))
    out.push(cronbachAlpha(reduced))
  }
  return out
}

// ─── Floor / ceiling effect detection ─────────────────────────────────────────
// Flags if >15% of participants scored at the min or max possible.

export function floorCeilingEffects(
  totals: number[],
  minPossible: number,
  maxPossible: number,
  threshold = 0.15,
): { floor: boolean; ceiling: boolean; floorPct: number; ceilingPct: number } {
  if (totals.length === 0) {
    return { floor: false, ceiling: false, floorPct: 0, ceilingPct: 0 }
  }
  const floorN   = totals.filter(t => t === minPossible).length
  const ceilingN = totals.filter(t => t === maxPossible).length
  const floorPct = floorN / totals.length
  const ceilPct  = ceilingN / totals.length
  return {
    floor: floorPct > threshold,
    ceiling: ceilPct > threshold,
    floorPct,
    ceilingPct: ceilPct,
  }
}

// ─── Alpha interpretation ─────────────────────────────────────────────────────

export function alphaInterpretation(alpha: number): { label: string; color: string } {
  if (isNaN(alpha))     return { label: 'N/A (not enough data)', color: '#8B7355' }
  if (alpha >= 0.9)     return { label: 'Excellent',             color: '#2D6A4F' }
  if (alpha >= 0.8)     return { label: 'Good',                  color: '#52B788' }
  if (alpha >= 0.7)     return { label: 'Acceptable',            color: '#E9C46A' }
  if (alpha >= 0.6)     return { label: 'Questionable',          color: '#F4A261' }
  if (alpha >= 0.5)     return { label: 'Poor',                  color: '#E76F51' }
  return                       { label: 'Unacceptable',          color: '#E63946' }
}
