# Scoring reference implementations

One dedicated Python script per subtest/calculation in the app, each
implementing the published/standard method exactly, with citations and a
self-test:

- `iat_dscore.py` — the IAT D-score (all 5 IAT variants share this same
  algorithm). Greenwald, Nosek & Banaji (2003), Table 4, Measure D6.
- `phq9.py` — PHQ-9 depression screening. Kroenke, Spitzer & Williams (2001).
- `gad7.py` — GAD-7 anxiety screening. Spitzer, Kroenke, Williams & Löwe (2006).
- `sociogram_metrics.py` — the sociogram's network-analysis measures
  (reciprocity, clustering, centrality, modularity, community detection).
  Each function cites the specific formula it implements.

Run any script directly to execute its self-test:

```bash
python3 scripts/scoring/iat_dscore.py
python3 scripts/scoring/phq9.py
python3 scripts/scoring/gad7.py
python3 scripts/scoring/sociogram_metrics.py
```

## Why this exists

These are reference implementations for verification and documentation —
they're what the production TypeScript scoring logic is checked against,
not a runtime dependency (the app is Next.js and doesn't call Python).
Each script's docstring is the citation trail: read it before trusting or
changing any scoring logic in the app.

## 2026-08-20 audit — what was found and fixed

Every calculation in the app was checked against its published/standard
method. Three findings:

1. **IAT D-score had real bugs relative to the published algorithm**
   ([app/(participant)/participant/iat/[iatid]/page.tsx](../../app/(participant)/participant/iat/[iatid]/page.tsx),
   `computeDScore()`). Verified against Greenwald, Nosek & Banaji (2003)
   Table 4 and cross-checked line-by-line against the authors' own
   distributed SAS scoring syntax. The previous implementation:
   - grouped blocks by task condition ({B3,B4} vs {B6,B7}) instead of by
     round ({B3,B6} vs {B4,B7}) — the published algorithm pairs by round;
   - used one grand pooled SD across all four blocks instead of two
     separate round-pair SDs, each dividing its own round's mean
     difference, then averaged;
   - used a combined-block-pair mean for the error-latency penalty
     instead of each individual block's own mean;
   - capped (winsorized) trials over 10,000 ms instead of deleting them;
   - was missing the sub-400ms trial deletion the D6 variant requires;
   - computed the fast-response exclusion check as one flat fraction over
     all trials instead of the mean of each block's own fraction.

   All fixed to match `iat_dscore.py` exactly — cross-validated by running
   the same synthetic trial set through both the corrected TypeScript and
   the Python reference and confirming identical output to floating-point
   precision (d = 0.7791004422029275 vs 0.7791004422029277).

   This directly affects the Death/Suicide IAT's clinical-cutoff alerts —
   the D-score bug was real, not cosmetic.

2. **PHQ-9 / GAD-7 scoring** ([lib/scales.ts](../../lib/scales.ts), the
   scoring logic in
   [app/(participant)/participant/questionnaire/[qid]/page.tsx](../../app/(participant)/participant/questionnaire/[qid]/page.tsx)):
   already correct — item text, response scale, severity bands, and the
   PHQ-9 item-9 standalone suicide-risk flag all match the published
   instruments exactly. No changes made; `phq9.py`/`gad7.py` exist as the
   now-documented reference.

3. **Sociogram network metrics**
   ([lib/sociogram-analytics.ts](../../lib/sociogram-analytics.ts)):
   already correct standard graph-theory formulas (Brandes' betweenness,
   Wasserman & Faust closeness, Bonacich eigenvector centrality, Leicht &
   Newman directed modularity, Raghavan et al. label propagation). No
   changes made; cross-validated numerically identical to
   `sociogram_metrics.py` on a test graph.
