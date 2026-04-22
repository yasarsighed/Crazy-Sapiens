// Sociogram network analytics — pure functions, no external deps.
// Node IDs are 0-indexed integers throughout.

export type DirectedEdge = [from: number, to: number]

// ─── Graph helpers ────────────────────────────────────────────────────────────

function outAdj(n: number, edges: DirectedEdge[]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const [a, b] of edges) if (a !== b) adj[a].push(b)
  return adj
}

function undirectedAdj(n: number, edges: DirectedEdge[]): Set<number>[] {
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set())
  for (const [a, b] of edges) {
    if (a === b) continue
    adj[a].add(b)
    adj[b].add(a)
  }
  return adj
}

// ─── Reciprocity ──────────────────────────────────────────────────────────────
// Fraction of directed edges that have a reciprocated counterpart (a→b AND b→a).

export function reciprocity(edges: DirectedEdge[]): number {
  if (edges.length === 0) return 0
  const set = new Set(edges.map(([a, b]) => `${a}>${b}`))
  let reciprocated = 0
  for (const [a, b] of edges) if (set.has(`${b}>${a}`)) reciprocated++
  return reciprocated / edges.length
}

// ─── Clustering coefficient (global, undirected) ──────────────────────────────
// Average of local clustering coefficients.

export function clusteringCoefficient(n: number, edges: DirectedEdge[]): number {
  const adj = undirectedAdj(n, edges)
  let sum = 0
  let counted = 0
  for (let i = 0; i < n; i++) {
    const neighbors = [...adj[i]]
    const k = neighbors.length
    if (k < 2) continue
    let triangles = 0
    for (let a = 0; a < neighbors.length; a++)
      for (let b = a + 1; b < neighbors.length; b++)
        if (adj[neighbors[a]].has(neighbors[b])) triangles++
    sum += (2 * triangles) / (k * (k - 1))
    counted++
  }
  return counted === 0 ? 0 : sum / counted
}

// ─── Connected components (undirected) ────────────────────────────────────────

export function connectedComponents(n: number, edges: DirectedEdge[]): number[] {
  const adj = undirectedAdj(n, edges)
  const comp = new Array(n).fill(-1)
  let c = 0
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1) continue
    const stack = [i]
    while (stack.length) {
      const v = stack.pop()!
      if (comp[v] !== -1) continue
      comp[v] = c
      for (const u of adj[v]) if (comp[u] === -1) stack.push(u)
    }
    c++
  }
  return comp
}

// ─── Brandes' betweenness centrality (unweighted, directed) ───────────────────
// Returns normalized values in [0, 1].

export function betweennessCentrality(n: number, edges: DirectedEdge[]): number[] {
  const adj = outAdj(n, edges)
  const cb = new Array(n).fill(0)

  for (let s = 0; s < n; s++) {
    const stack: number[] = []
    const pred: number[][] = Array.from({ length: n }, () => [])
    const sigma = new Array(n).fill(0); sigma[s] = 1
    const dist = new Array(n).fill(-1); dist[s] = 0
    const queue: number[] = [s]
    while (queue.length) {
      const v = queue.shift()!
      stack.push(v)
      for (const w of adj[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; queue.push(w) }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v) }
      }
    }
    const delta = new Array(n).fill(0)
    while (stack.length) {
      const w = stack.pop()!
      for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
      if (w !== s) cb[w] += delta[w]
    }
  }

  const norm = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1
  return cb.map(v => v * norm)
}

// ─── Closeness centrality (directed, incoming paths) ──────────────────────────
// Measures how easily a node is reached from others.

export function closenessCentrality(n: number, edges: DirectedEdge[]): number[] {
  // Build reverse adjacency: who points to me
  const rev: number[][] = Array.from({ length: n }, () => [])
  for (const [a, b] of edges) if (a !== b) rev[b].push(a)

  const out = new Array(n).fill(0)
  for (let t = 0; t < n; t++) {
    // BFS backwards from t in original graph = BFS forward in reverse graph
    const dist = new Array(n).fill(-1); dist[t] = 0
    const queue = [t]
    let totalDist = 0
    let reached = 0
    while (queue.length) {
      const v = queue.shift()!
      for (const u of rev[v]) {
        if (dist[u] < 0) { dist[u] = dist[v] + 1; queue.push(u); totalDist += dist[u]; reached++ }
      }
    }
    out[t] = totalDist > 0 ? (reached / (n - 1)) * (reached / totalDist) : 0
  }
  return out
}

// ─── Eigenvector centrality (power iteration on in-degree adjacency) ──────────

export function eigenvectorCentrality(n: number, edges: DirectedEdge[], iter = 100): number[] {
  // Use in-degree: a node is important if important nodes point to it.
  const inAdj: number[][] = Array.from({ length: n }, () => [])
  for (const [a, b] of edges) if (a !== b) inAdj[b].push(a)

  let x = new Array(n).fill(1 / Math.sqrt(n))
  for (let k = 0; k < iter; k++) {
    const y = new Array(n).fill(0)
    for (let i = 0; i < n; i++) for (const j of inAdj[i]) y[i] += x[j]
    const norm = Math.sqrt(y.reduce((s, v) => s + v * v, 0)) || 1
    const next = y.map(v => v / norm)
    let diff = 0
    for (let i = 0; i < n; i++) diff += Math.abs(next[i] - x[i])
    x = next
    if (diff < 1e-8) break
  }
  return x
}

// ─── Community detection via label propagation (undirected) ───────────────────
// Deterministic-ish: iterates in fixed order, breaks ties by lowest label.
// Good enough for sociogram-scale networks (n < 200).

export function labelPropagationCommunities(n: number, edges: DirectedEdge[]): number[] {
  const adj = undirectedAdj(n, edges)
  const labels = Array.from({ length: n }, (_, i) => i)
  const maxIter = 50

  for (let it = 0; it < maxIter; it++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      if (adj[i].size === 0) continue
      const counts = new Map<number, number>()
      for (const j of adj[i]) counts.set(labels[j], (counts.get(labels[j]) ?? 0) + 1)
      // Pick label with max count; tie-break by lowest label id
      let best = labels[i], bestCount = -1
      for (const [lbl, c] of counts) {
        if (c > bestCount || (c === bestCount && lbl < best)) { best = lbl; bestCount = c }
      }
      if (best !== labels[i]) { labels[i] = best; changed = true }
    }
    if (!changed) break
  }

  // Renumber communities to 0..k-1
  const remap = new Map<number, number>()
  return labels.map(l => {
    if (!remap.has(l)) remap.set(l, remap.size)
    return remap.get(l)!
  })
}

// ─── Modularity (for reporting) ───────────────────────────────────────────────

export function modularity(n: number, edges: DirectedEdge[], communities: number[]): number {
  const m = edges.length
  if (m === 0) return 0
  const inDeg = new Array(n).fill(0)
  const outDeg = new Array(n).fill(0)
  for (const [a, b] of edges) { outDeg[a]++; inDeg[b]++ }

  // Build edge count per pair for quick A_ij lookup
  const edgeCount = new Map<string, number>()
  for (const [a, b] of edges) {
    const k = `${a}>${b}`
    edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1)
  }

  let q = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (communities[i] !== communities[j]) continue
      const aij = edgeCount.get(`${i}>${j}`) ?? 0
      q += aij - (outDeg[i] * inDeg[j]) / m
    }
  }
  return q / m
}

// ─── Edge list CSV export (Gephi-compatible) ──────────────────────────────────

export function edgeListCSV(
  nodes: { id: number; name: string }[],
  edges: Array<[number, number, string, number]>, // [source, target, typeId, weight]
  relTypeLabels: Record<string, string>,
): string {
  const rows = ['Source,Target,Type,Weight,RelationshipLabel']
  const lookup = Object.fromEntries(nodes.map(n => [n.id, n.name.replace(/[",]/g, ' ')]))
  for (const [s, t, typeId, w] of edges) {
    const label = (relTypeLabels[typeId] ?? typeId).replace(/[",]/g, ' ')
    rows.push(`"${lookup[s] ?? s}","${lookup[t] ?? t}",Directed,${w},"${label}"`)
  }
  return rows.join('\n')
}

export function nodeListCSV(
  nodes: { id: number; name: string }[],
  metrics: {
    inDegree: number[]
    outDegree: number[]
    betweenness: number[]
    closeness: number[]
    eigenvector: number[]
    community: number[]
  },
): string {
  const rows = ['Id,Label,InDegree,OutDegree,Betweenness,Closeness,Eigenvector,Community']
  for (const n of nodes) {
    const safe = n.name.replace(/[",]/g, ' ')
    rows.push([
      n.id,
      `"${safe}"`,
      metrics.inDegree[n.id] ?? 0,
      metrics.outDegree[n.id] ?? 0,
      (metrics.betweenness[n.id] ?? 0).toFixed(4),
      (metrics.closeness[n.id] ?? 0).toFixed(4),
      (metrics.eigenvector[n.id] ?? 0).toFixed(4),
      metrics.community[n.id] ?? 0,
    ].join(','))
  }
  return rows.join('\n')
}
