"""
Sociogram network metrics — reference implementation.

These are standard social-network-analysis measures, not a single
"published test" like PHQ-9/GAD-7/IAT, so each function cites the
specific formula/algorithm it implements rather than one paper:

  - reciprocity: fraction of directed ties with a reciprocated
    counterpart (Wasserman & Faust, 1994, Social Network Analysis,
    ch. 13).
  - clustering_coefficient: Watts & Strogatz (1998) average local
    clustering coefficient, "Collective dynamics of 'small-world'
    networks." Nature, 393, 440-442.
  - betweenness_centrality: Brandes (2001), "A faster algorithm for
    betweenness centrality." Journal of Mathematical Sociology, 25(2),
    163-177. Normalized for a DIRECTED graph by 1/((n-1)(n-2))
    (Freeman, 1977 normalization, directed form).
  - closeness_centrality: Wasserman & Faust's (1994) formula for
    closeness in a possibly-disconnected graph — (reachable/(n-1)) *
    (reachable/sum-of-distances) — equivalent to NetworkX's
    wf_improved=True closeness, chosen because sociograms are frequently
    disconnected and the classic Bavelas (1950) formula is undefined
    there.
  - eigenvector_centrality: Bonacich (1972) eigenvector centrality via
    power iteration on the in-degree adjacency (a node is important if
    important nodes nominate it).
  - modularity: Leicht & Newman (2007), "Community structure in
    directed networks." Physical Review Letters, 100(11), 118703 —
    the directed-graph modularity formula.
  - label_propagation_communities: Raghavan, Albert & Kumara (2007),
    "Near linear time algorithm to detect community structures in
    large-scale networks." Physical Review E, 76(3), 036106.

Mirrors lib/sociogram-analytics.ts function-for-function so the two can
be diffed directly; node IDs are 0-indexed integers throughout, same as
the TypeScript version.
"""

from __future__ import annotations

from collections import deque


DirectedEdge = tuple[int, int]


def _out_adj(n: int, edges: list[DirectedEdge]) -> list[list[int]]:
    adj: list[list[int]] = [[] for _ in range(n)]
    for a, b in edges:
        if a != b:
            adj[a].append(b)
    return adj


def _undirected_adj(n: int, edges: list[DirectedEdge]) -> list[set[int]]:
    adj: list[set[int]] = [set() for _ in range(n)]
    for a, b in edges:
        if a == b:
            continue
        adj[a].add(b)
        adj[b].add(a)
    return adj


def reciprocity(edges: list[DirectedEdge]) -> float:
    if not edges:
        return 0.0
    pairs = set(edges)
    reciprocated = sum(1 for a, b in edges if (b, a) in pairs)
    return reciprocated / len(edges)


def clustering_coefficient(n: int, edges: list[DirectedEdge]) -> float:
    adj = _undirected_adj(n, edges)
    total = 0.0
    counted = 0
    for i in range(n):
        neighbors = list(adj[i])
        k = len(neighbors)
        if k < 2:
            continue
        triangles = 0
        for a in range(len(neighbors)):
            for b in range(a + 1, len(neighbors)):
                if neighbors[b] in adj[neighbors[a]]:
                    triangles += 1
        total += (2 * triangles) / (k * (k - 1))
        counted += 1
    return 0.0 if counted == 0 else total / counted


def connected_components(n: int, edges: list[DirectedEdge]) -> list[int]:
    adj = _undirected_adj(n, edges)
    comp = [-1] * n
    c = 0
    for i in range(n):
        if comp[i] != -1:
            continue
        stack = [i]
        while stack:
            v = stack.pop()
            if comp[v] != -1:
                continue
            comp[v] = c
            for u in adj[v]:
                if comp[u] == -1:
                    stack.append(u)
        c += 1
    return comp


def betweenness_centrality(n: int, edges: list[DirectedEdge]) -> list[float]:
    adj = _out_adj(n, edges)
    cb = [0.0] * n

    for s in range(n):
        stack: list[int] = []
        pred: list[list[int]] = [[] for _ in range(n)]
        sigma = [0.0] * n
        sigma[s] = 1
        dist = [-1] * n
        dist[s] = 0
        queue = deque([s])
        while queue:
            v = queue.popleft()
            stack.append(v)
            for w in adj[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
        delta = [0.0] * n
        while stack:
            w = stack.pop()
            for v in pred[w]:
                delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                cb[w] += delta[w]

    norm = 1 / ((n - 1) * (n - 2)) if n > 2 else 1.0
    return [v * norm for v in cb]


def closeness_centrality(n: int, edges: list[DirectedEdge]) -> list[float]:
    rev: list[list[int]] = [[] for _ in range(n)]
    for a, b in edges:
        if a != b:
            rev[b].append(a)

    out = [0.0] * n
    for t in range(n):
        dist = [-1] * n
        dist[t] = 0
        queue = deque([t])
        total_dist = 0
        reached = 0
        while queue:
            v = queue.popleft()
            for u in rev[v]:
                if dist[u] < 0:
                    dist[u] = dist[v] + 1
                    queue.append(u)
                    total_dist += dist[u]
                    reached += 1
        out[t] = (reached / (n - 1)) * (reached / total_dist) if total_dist > 0 else 0.0
    return out


def eigenvector_centrality(n: int, edges: list[DirectedEdge], iterations: int = 100) -> list[float]:
    in_adj: list[list[int]] = [[] for _ in range(n)]
    for a, b in edges:
        if a != b:
            in_adj[b].append(a)

    x = [1 / (n ** 0.5)] * n
    for _ in range(iterations):
        y = [0.0] * n
        for i in range(n):
            for j in in_adj[i]:
                y[i] += x[j]
        norm = (sum(v * v for v in y)) ** 0.5 or 1.0
        nxt = [v / norm for v in y]
        diff = sum(abs(nxt[i] - x[i]) for i in range(n))
        x = nxt
        if diff < 1e-8:
            break
    return x


def label_propagation_communities(n: int, edges: list[DirectedEdge]) -> list[int]:
    adj = _undirected_adj(n, edges)
    labels = list(range(n))
    max_iter = 50

    for _ in range(max_iter):
        changed = False
        for i in range(n):
            if not adj[i]:
                continue
            counts: dict[int, int] = {}
            for j in adj[i]:
                counts[labels[j]] = counts.get(labels[j], 0) + 1
            best, best_count = labels[i], -1
            for lbl, c in counts.items():
                if c > best_count or (c == best_count and lbl < best):
                    best, best_count = lbl, c
            if best != labels[i]:
                labels[i] = best
                changed = True
        if not changed:
            break

    remap: dict[int, int] = {}
    result = []
    for l in labels:
        if l not in remap:
            remap[l] = len(remap)
        result.append(remap[l])
    return result


def maximal_cliques(n: int, edges: list[DirectedEdge], min_size: int = 3) -> list[list[int]]:
    """Bron-Kerbosch with pivoting (Tomita et al., 2006). Direction ignored,
    same convention as clustering_coefficient. Mirrors
    lib/sociogram-analytics.ts's maximalCliques() exactly — see that
    function's docstring for the citation."""
    adj = _undirected_adj(n, edges)
    cliques: list[list[int]] = []

    def bron_kerbosch(r: set[int], p: set[int], x: set[int]) -> None:
        if not p and not x:
            if len(r) >= min_size:
                cliques.append(sorted(r))
            return
        pivot, pivot_count = -1, -1
        for v in p | x:
            count = len(adj[v] & p)
            if count > pivot_count:
                pivot, pivot_count = v, count
        candidates = [v for v in p if pivot == -1 or v not in adj[pivot]]
        for v in candidates:
            neighbors = adj[v]
            bron_kerbosch(r | {v}, p & neighbors, x & neighbors)
            p = p - {v}
            x = x | {v}

    bron_kerbosch(set(), set(range(n)), set())
    return cliques


def modularity(n: int, edges: list[DirectedEdge], communities: list[int]) -> float:
    m = len(edges)
    if m == 0:
        return 0.0
    in_deg = [0] * n
    out_deg = [0] * n
    for a, b in edges:
        out_deg[a] += 1
        in_deg[b] += 1

    edge_count: dict[tuple[int, int], int] = {}
    for a, b in edges:
        edge_count[(a, b)] = edge_count.get((a, b), 0) + 1

    q = 0.0
    for i in range(n):
        for j in range(n):
            if communities[i] != communities[j]:
                continue
            aij = edge_count.get((i, j), 0)
            q += aij - (out_deg[i] * in_deg[j]) / m
    return q / m


def _self_test() -> None:
    # A simple triangle with one reciprocated edge: 0->1, 1->0, 1->2, 2->0
    edges: list[DirectedEdge] = [(0, 1), (1, 0), (1, 2), (2, 0)]
    n = 3

    assert reciprocity(edges) == 0.5, "2 of 4 directed edges (0->1,1->0) are reciprocated."

    cc = connected_components(n, edges)
    assert len(set(cc)) == 1, "All 3 nodes are connected."

    bc = betweenness_centrality(n, edges)
    assert all(v >= 0 for v in bc)

    clc = closeness_centrality(n, edges)
    assert all(0 <= v <= 1 for v in clc)

    ec = eigenvector_centrality(n, edges)
    assert abs(sum(v * v for v in ec) - 1.0) < 1e-6, "Eigenvector centrality should be unit-normalized."

    comms = label_propagation_communities(n, edges)
    q = modularity(n, edges, comms)
    assert -1.0 <= q <= 1.0

    print("All sociogram-metrics self-tests passed.")


if __name__ == "__main__":
    _self_test()
