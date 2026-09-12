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
  - katz_centrality: Katz (1953), "A new status index derived from
    sociometric analysis." Psychometrika, 18(1), 39-43. x_i = beta +
    alpha * sum of x_j over people j who chose i, beta = 1, alpha =
    0.85 / largest eigenvalue (0.5 when ties never loop back, where the
    eigenvalue is 0). Replaces eigenvector centrality, which is undefined
    on one-way networks. Cross-checked against NetworkX
    katz_centrality(normalized=False).
  - modularity: Leicht & Newman (2007), "Community structure in
    directed networks." Physical Review Letters, 100(11), 118703 —
    the directed-graph modularity formula.
  - modularity_communities: greedy agglomerative modularity maximisation
    in the spirit of Clauset, Newman & Moore (2004), "Finding community
    structure in very large networks." Physical Review E, 70, 066111.
    Optimises the same directed modularity that modularity() reports.
    Replaces label propagation (Raghavan et al., 2007), whose fixed-order
    variant merged two cliques joined by one bridge person into a single
    community.

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


KATZ_BETA = 1.0
KATZ_ALPHA_SHARE = 0.85
KATZ_FALLBACK_ALPHA = 0.5


def _strongly_connected_components(n: int, ties: list[DirectedEdge]) -> list[list[int]]:
    """Kosaraju, iterative. Mirrors stronglyConnectedComponents() in the TS file."""
    out: list[list[int]] = [[] for _ in range(n)]
    inn: list[list[int]] = [[] for _ in range(n)]
    for a, b in ties:
        out[a].append(b)
        inn[b].append(a)
    seen = [False] * n
    order: list[int] = []
    for s in range(n):
        if seen[s]:
            continue
        seen[s] = True
        stack = [[s, 0]]
        while stack:
            top = stack[-1]
            v = top[0]
            if top[1] < len(out[v]):
                w = out[v][top[1]]
                top[1] += 1
                if not seen[w]:
                    seen[w] = True
                    stack.append([w, 0])
            else:
                stack.pop()
                order.append(v)
    comp = [-1] * n
    comps: list[list[int]] = []
    for s in reversed(order):
        if comp[s] != -1:
            continue
        c = len(comps)
        comps.append([])
        comp[s] = c
        st = [s]
        while st:
            v = st.pop()
            comps[c].append(v)
            for w in inn[v]:
                if comp[w] == -1:
                    comp[w] = c
                    st.append(w)
    return comps


def largest_eigenvalue(n: int, edges: list[DirectedEdge]) -> float:
    """Spectral radius: max over strongly connected components (block-triangular
    matrix). 0 when ties never loop back; otherwise power iteration on the
    component's primitive (A + I), which converges geometrically to the exact value."""
    ties = [(a, b) for a, b in edges if a != b]
    lam = 0.0
    for members in _strongly_connected_components(n, ties):
        if len(members) < 2:
            continue
        local = {v: i for i, v in enumerate(members)}
        sub = [(local[a], local[b]) for a, b in ties if a in local and b in local]
        m = len(members)
        x = [1 / (m ** 0.5)] * m
        r = 0.0
        for _ in range(20_000):
            y = list(x)
            for a, b in sub:
                y[b] += x[a]
            norm = sum(v * v for v in y) ** 0.5
            x = [v / norm for v in y]
            done = abs(norm - r) < 1e-13 * norm
            r = norm
            if done:
                break
        lam = max(lam, r - 1)
    return lam


def katz_centrality(n: int, edges: list[DirectedEdge]) -> tuple[list[float], float]:
    """Returns (scores, alpha). Mirrors katzCentrality() in lib/sociogram-analytics.ts."""
    lam = largest_eigenvalue(n, edges)
    alpha = KATZ_ALPHA_SHARE / lam if lam > 0 else KATZ_FALLBACK_ALPHA
    ties = [(a, b) for a, b in edges if a != b]
    x = [KATZ_BETA] * n
    for _ in range(100_000):
        nxt = [KATZ_BETA] * n
        for a, b in ties:
            nxt[b] += alpha * x[a]
        diff = max((abs(nxt[i] - x[i]) for i in range(n)), default=0.0)
        x = nxt
        if diff < 1e-12:
            break
    return x, alpha


def modularity_communities(n: int, edges: list[DirectedEdge]) -> list[int]:
    ties = [(a, b) for a, b in edges if a != b]
    m = len(ties)
    comm = list(range(n))
    if m == 0:
        return comm

    k_out = {i: 0 for i in range(n)}
    k_in = {i: 0 for i in range(n)}
    between: dict[tuple[int, int], int] = {}
    for a, b in ties:
        k_out[a] += 1
        k_in[b] += 1
        between[(a, b)] = between.get((a, b), 0) + 1

    while True:
        pairs = sorted({(min(a, b), max(a, b)) for a, b in between if a != b},
                       key=lambda p: f"{p[0]}|{p[1]}")  # same order as the TS string sort
        best = None
        best_gain = 1e-12
        for a, b in pairs:
            eab = between.get((a, b), 0) + between.get((b, a), 0)
            gain = eab / m - (k_out[a] * k_in[b] + k_out[b] * k_in[a]) / (m * m)
            if gain > best_gain:
                best_gain, best = gain, (a, b)
        if best is None:
            break
        keep, gone = best
        comm = [keep if c == gone else c for c in comm]
        k_out[keep] += k_out.pop(gone)
        k_in[keep] += k_in.pop(gone)
        merged: dict[tuple[int, int], int] = {}
        for (x, y), count in between.items():
            key = (keep if x == gone else x, keep if y == gone else y)
            merged[key] = merged.get(key, 0) + count
        between = merged

    remap: dict[int, int] = {}
    result = []
    for l in comm:
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

    kz, kz_alpha = katz_centrality(n, edges)
    assert abs(largest_eigenvalue(n, edges) - 1.3247179572) < 1e-6, "Plastic number: root of l^3 = l + 1."
    assert abs(kz_alpha - 0.85 / 1.3247179572) < 1e-6
    assert all(v >= 1.0 for v in kz), "Katz scores are never below the baseline."

    comms = modularity_communities(n, edges)
    q = modularity(n, edges, comms)
    assert -1.0 <= q <= 1.0

    # One-way network: 0, 1, 3 choose 2; 2 chooses 4. Hand values with alpha 0.5.
    kz_dag, a_dag = katz_centrality(5, [(0, 2), (1, 2), (3, 2), (2, 4)])
    assert a_dag == 0.5
    assert all(abs(v - e) < 1e-12 for v, e in zip(kz_dag, [1, 1, 2.5, 1, 2.25])), kz_dag

    # Two reciprocated triangles bridged by one tie must give two communities.
    tri = [(0, 1), (1, 0), (1, 2), (2, 1), (0, 2), (2, 0),
           (3, 4), (4, 3), (4, 5), (5, 4), (3, 5), (5, 3), (2, 3), (3, 2)]
    bridged = modularity_communities(6, tri)
    assert len(set(bridged)) == 2 and bridged[0] == bridged[2] and bridged[3] == bridged[5], bridged
    assert modularity(6, tri, bridged) > 0.3

    print("All sociogram-metrics self-tests passed.")


if __name__ == "__main__":
    _self_test()
