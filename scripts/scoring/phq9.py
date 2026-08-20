"""
PHQ-9 (Patient Health Questionnaire-9) — depression severity scoring.

Reference: Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: Validity of a
brief depression severity measure. J Gen Intern Med. 2001;16(9):606-613.

Scoring, per the published measure:
  - 9 items, each answered on a 0-3 frequency scale
    (0 = Not at all, 1 = Several days, 2 = More than half the days,
     3 = Nearly every day).
  - Total score = sum of the 9 item scores. Range: 0-27.
  - Severity bands: 0-4 Minimal, 5-9 Mild, 10-14 Moderate,
    15-19 Moderately severe, 20-27 Severe.
  - Item 9 ("thoughts that you would be better off dead or of hurting
    yourself in some way") is scored the same way but is ALSO read as a
    standalone clinical flag: any response >= 1 warrants review
    regardless of the total score, per the PHQ-9's own scoring guidance
    and standard clinical practice — a participant can score low overall
    while still endorsing this item, and that must not be masked by the
    total.
"""

from __future__ import annotations

from dataclasses import dataclass

ITEM_COUNT = 9
MAX_ITEM_SCORE = 3
MAX_TOTAL = ITEM_COUNT * MAX_ITEM_SCORE  # 27

SEVERITY_BANDS = [
    ("Minimal", "minimal", 0, 4),
    ("Mild", "mild", 5, 9),
    ("Moderate", "moderate", 10, 14),
    ("Moderately Severe", "moderately_severe", 15, 19),
    ("Severe", "severe", 20, 27),
]

ITEM9_INDEX = 8  # zero-based; the 9th item is the suicidal-ideation item
CLINICAL_ALERT_THRESHOLD = 10  # total >= 10 warrants further evaluation


@dataclass(frozen=True)
class PHQ9Result:
    total_score: int
    severity_label: str
    severity_category: str
    item9_flagged: bool
    clinical_alert: bool


def score(item_responses: list[int]) -> PHQ9Result:
    """item_responses: exactly 9 integers, each 0-3, in item order (1-9)."""
    if len(item_responses) != ITEM_COUNT:
        raise ValueError(f"PHQ-9 requires exactly {ITEM_COUNT} item responses, got {len(item_responses)}.")
    for i, v in enumerate(item_responses, start=1):
        if not (0 <= v <= MAX_ITEM_SCORE):
            raise ValueError(f"Item {i} response {v} is out of the valid 0-{MAX_ITEM_SCORE} range.")

    total = sum(item_responses)
    label, category = next(
        (lbl, cat) for lbl, cat, lo, hi in SEVERITY_BANDS if lo <= total <= hi
    )
    item9_flagged = item_responses[ITEM9_INDEX] >= 1

    return PHQ9Result(
        total_score=total,
        severity_label=label,
        severity_category=category,
        item9_flagged=item9_flagged,
        clinical_alert=(total >= CLINICAL_ALERT_THRESHOLD) or item9_flagged,
    )


def _self_test() -> None:
    # All-zero: minimal, no flag.
    r = score([0] * 9)
    assert r.total_score == 0 and r.severity_category == "minimal" and not r.clinical_alert

    # Item 9 endorsed but everything else zero: low total, must still alert.
    r = score([0, 0, 0, 0, 0, 0, 0, 0, 1])
    assert r.total_score == 1 and r.item9_flagged and r.clinical_alert, \
        "Item 9 endorsement must trigger an alert even with a minimal total score."

    # Boundary of Moderate/Moderately-severe bands.
    r = score([2, 2, 2, 2, 2, 2, 2, 1, 0])
    assert r.total_score == 15 and r.severity_category == "moderately_severe"

    # Maximum score.
    r = score([3] * 9)
    assert r.total_score == 27 and r.severity_category == "severe" and r.clinical_alert

    print("All PHQ-9 self-tests passed.")


if __name__ == "__main__":
    _self_test()
