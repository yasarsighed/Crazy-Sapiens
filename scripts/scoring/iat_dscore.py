"""
IAT D-score — Greenwald, Nosek & Banaji (2003) "improved scoring algorithm."

Reference: Greenwald, A. G., Nosek, B. A., & Banaji, M. R. (2003).
Understanding and using the Implicit Association Test: I. An improved
scoring algorithm. Journal of Personality and Social Psychology, 85(2),
197-216. Table 4 (the "Improved algorithm" column, which is Measure D6 in
the paper's Study 6 comparison — the top overall performer).

This implementation was checked line-by-line against the authors' own
distributed SAS scoring syntax (Brian Nosek, projectimplicit.net/nosek/
papers/scoringalgorithm.sas.txt), since Table 4's prose is easy to
misread. In particular:

  - Blocks are paired by ROUND, not by task condition: {B3, B6} form one
    pooled group (both are the shorter "practice" round of the two
    combined-task blocks) and {B4, B7} form the other (both are the
    longer "test" round). This is NOT {B3, B4} vs {B6, B7} — pairing by
    condition instead of by round is a common, incorrect first guess.
  - The error-penalty replacement value for a trial uses THAT block's own
    mean of correct latencies (e.g. an error in B3 is replaced using B3's
    own mean), not a mean pooled across a block pair.
  - The pooled SD (the denominator) is the plain sample SD of the
    *penalized* latencies from the two round-mates combined — not a
    weighted/pooled-variance formula, and not restricted to correct
    trials only (that restriction is the SAS syntax's alternate "delete
    errors" branch, not the error-penalty branch used here).
  - Trials with RT > 10,000 ms are DELETED, not capped/winsorized.
  - The <300 ms subject-exclusion check is the mean, across the four
    blocks, of each block's own fraction of trials under 300 ms (not one
    flat fraction over all trials pooled).
  - This is specifically the "D6" variant: 600 ms error penalty AND
    deletion of trials under 400 ms (Table 4's main "Improved algorithm"
    column). D6 was the best-performing measure overall in Study 6.

Usage:
    python iat_dscore.py < trials.json
    (or import compute_d_score() directly)

Input trial shape (one dict per trial):
    {"block": 3 | 4 | 6 | 7, "rt_ms": float, "correct": bool}
"""

from __future__ import annotations

import json
import statistics
import sys
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Trial:
    block: int
    rt_ms: float
    correct: bool


@dataclass(frozen=True)
class DScoreResult:
    d: float | None
    excluded: bool
    reason: str | None = None


SCORED_BLOCKS = (3, 4, 6, 7)
ROUND_PAIRS = ((3, 6), (4, 7))  # {B3,B6} and {B4,B7} — paired by ROUND, not condition


def _by_block(trials: list[Trial], block: int) -> list[Trial]:
    return [t for t in trials if t.block == block]


def _mean(values: list[float]) -> float:
    return statistics.mean(values)


def _sample_stdev(values: list[float]) -> float:
    # Table 4 / the SAS syntax's pooled SD is the plain sample SD (n-1)
    # of the combined round-pair's latencies — see module docstring.
    return statistics.stdev(values) if len(values) > 1 else 0.0


def compute_d_score(
    trials: list[Trial],
    assigned_order: Literal["A", "B"] = "A",
    min_trials_per_block: int = 1,
) -> DScoreResult:
    """Compute the D6 IAT effect size per Greenwald et al. (2003), Table 4.

    assigned_order: 'B' means the participant took the reversed block
    order (congruent/incongruent pairings swapped), so the raw
    difference direction is flipped to keep D comparable across both
    counterbalanced orders — the app's existing, correct convention.
    """
    data = [t for t in trials if t.block in SCORED_BLOCKS]

    # Step 2a (Table 4): delete trials with latency > 10,000 ms.
    data = [t for t in data if t.rt_ms <= 10_000]

    blocks = {b: _by_block(data, b) for b in SCORED_BLOCKS}
    if any(len(blocks[b]) == 0 for b in SCORED_BLOCKS):
        return DScoreResult(None, True, "One or more blocks has zero usable trials.")

    # Step 2b: subject-level exclusion — mean, across the four blocks, of
    # each block's own fraction of trials with latency < 300 ms.
    fast_fractions = [
        sum(1 for t in blocks[b] if t.rt_ms < 300) / len(blocks[b])
        for b in SCORED_BLOCKS
    ]
    if _mean(fast_fractions) > 0.10:
        return DScoreResult(
            None, True,
            f"{round(_mean(fast_fractions) * 100)}% mean fast-response rate across blocks exceeds the 10% exclusion threshold.",
        )

    # Step 4 (D6 variant): delete trials with latency < 400 ms.
    data = [t for t in data if t.rt_ms >= 400]
    blocks = {b: _by_block(data, b) for b in SCORED_BLOCKS}
    if any(len(blocks[b]) < min_trials_per_block for b in SCORED_BLOCKS):
        return DScoreResult(None, True, "Insufficient trials remaining in one or more blocks after the 400 ms floor.")

    # Step 5: mean of CORRECT latencies, per individual block (pre-penalty).
    block_means: dict[int, float] = {}
    for b in SCORED_BLOCKS:
        correct = [t.rt_ms for t in blocks[b] if t.correct]
        if not correct:
            return DScoreResult(None, True, f"Block {b} has no correct trials to compute a penalty mean from.")
        block_means[b] = _mean(correct)

    # Step 7: error penalty — that SAME block's own correct-mean + 600 ms.
    penalized: dict[int, list[float]] = {
        b: [t.rt_ms if t.correct else block_means[b] + 600 for t in blocks[b]]
        for b in SCORED_BLOCKS
    }

    # Step 9: block averages of the penalized values.
    block_avg = {b: _mean(penalized[b]) for b in SCORED_BLOCKS}

    # Step 6: pooled SD of the penalized values, combined by ROUND pair.
    pooled_sd = {
        pair: _sample_stdev(penalized[pair[0]] + penalized[pair[1]])
        for pair in ROUND_PAIRS
    }
    if any(sd == 0 for sd in pooled_sd.values()):
        return DScoreResult(None, True, "A round pair has zero variance in penalized latencies.")

    # Step 10-12: two round-quotients, averaged.
    diff_36 = block_avg[6] - block_avg[3]
    diff_47 = block_avg[7] - block_avg[4]
    quotient_36 = diff_36 / pooled_sd[(3, 6)]
    quotient_47 = diff_47 / pooled_sd[(4, 7)]
    d = (quotient_36 + quotient_47) / 2

    return DScoreResult(-d if assigned_order == "B" else d, False)


def _self_test() -> None:
    """A small hand-checkable example, run with no stdin input."""
    rng_trials: list[Trial] = []
    # B3: 20 trials ~700ms correct, 2 errors
    for i in range(20):
        rng_trials.append(Trial(3, 700 + (i % 5) * 10, correct=(i % 10 != 0)))
    # B4: 40 trials ~680ms correct
    for i in range(40):
        rng_trials.append(Trial(4, 680 + (i % 7) * 10, correct=(i % 15 != 0)))
    # B6 (reversed pairing, slower): 20 trials ~850ms
    for i in range(20):
        rng_trials.append(Trial(6, 850 + (i % 5) * 10, correct=(i % 10 != 0)))
    # B7: 40 trials ~820ms
    for i in range(40):
        rng_trials.append(Trial(7, 820 + (i % 7) * 10, correct=(i % 15 != 0)))

    result = compute_d_score(rng_trials, assigned_order="A")
    print("Self-test result:", result)
    assert not result.excluded
    assert result.d is not None and result.d > 0, "Expected a positive D given B6/B7 are slower than B3/B4."
    print("Self-test passed: B6/B7 slower than B3/B4 correctly yields a positive D.")


def main() -> None:
    if sys.stdin.isatty():
        _self_test()
        return
    payload = json.load(sys.stdin)
    trials = [Trial(t["block"], t["rt_ms"], t["correct"]) for t in payload["trials"]]
    order = payload.get("assigned_order", "A")
    result = compute_d_score(trials, assigned_order=order)
    json.dump({"d": result.d, "excluded": result.excluded, "reason": result.reason}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
