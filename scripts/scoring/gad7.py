"""
GAD-7 (Generalized Anxiety Disorder-7) — anxiety severity scoring.

Reference: Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure
for assessing generalized anxiety disorder. Arch Intern Med.
2006;166(10):1092-1097.

Scoring, per the published measure:
  - 7 items, each answered on a 0-3 frequency scale
    (0 = Not at all, 1 = Several days, 2 = More than half the days,
     3 = Nearly every day).
  - Total score = sum of the 7 item scores. Range: 0-21.
  - Severity bands: 0-4 Minimal, 5-9 Mild, 10-14 Moderate, 15-21 Severe.
  - GAD-7 has no item-level clinical-flag item analogous to PHQ-9 item 9;
    the total-score threshold is the only alert trigger.
"""

from __future__ import annotations

from dataclasses import dataclass

ITEM_COUNT = 7
MAX_ITEM_SCORE = 3
MAX_TOTAL = ITEM_COUNT * MAX_ITEM_SCORE  # 21

SEVERITY_BANDS = [
    ("Minimal", "minimal", 0, 4),
    ("Mild", "mild", 5, 9),
    ("Moderate", "moderate", 10, 14),
    ("Severe", "severe", 15, 21),
]

CLINICAL_ALERT_THRESHOLD = 10  # total >= 10 warrants further evaluation


@dataclass(frozen=True)
class GAD7Result:
    total_score: int
    severity_label: str
    severity_category: str
    clinical_alert: bool


def score(item_responses: list[int]) -> GAD7Result:
    """item_responses: exactly 7 integers, each 0-3, in item order (1-7)."""
    if len(item_responses) != ITEM_COUNT:
        raise ValueError(f"GAD-7 requires exactly {ITEM_COUNT} item responses, got {len(item_responses)}.")
    for i, v in enumerate(item_responses, start=1):
        if not (0 <= v <= MAX_ITEM_SCORE):
            raise ValueError(f"Item {i} response {v} is out of the valid 0-{MAX_ITEM_SCORE} range.")

    total = sum(item_responses)
    label, category = next(
        (lbl, cat) for lbl, cat, lo, hi in SEVERITY_BANDS if lo <= total <= hi
    )

    return GAD7Result(
        total_score=total,
        severity_label=label,
        severity_category=category,
        clinical_alert=total >= CLINICAL_ALERT_THRESHOLD,
    )


def _self_test() -> None:
    r = score([0] * 7)
    assert r.total_score == 0 and r.severity_category == "minimal" and not r.clinical_alert

    r = score([2, 2, 2, 2, 1, 0, 0])
    assert r.total_score == 9 and r.severity_category == "mild" and not r.clinical_alert

    r = score([2, 2, 2, 2, 1, 1, 0])
    assert r.total_score == 10 and r.severity_category == "moderate" and r.clinical_alert, \
        "Score of exactly 10 must be Moderate and must alert (threshold is >= 10)."

    r = score([3] * 7)
    assert r.total_score == 21 and r.severity_category == "severe" and r.clinical_alert

    print("All GAD-7 self-tests passed.")


if __name__ == "__main__":
    _self_test()
