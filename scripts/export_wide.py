"""
Crazy Sapiens — Wide CSV Export
Requires: pip install supabase pandas numpy networkx
"""

import os, re, sys, argparse
from pathlib import Path
from datetime import date, datetime
import numpy as np
import pandas as pd
import networkx as nx
from supabase import create_client

# ─── Load .env.local ──────────────────────────────────────────────────────────

env_path = Path(__file__).parent.parent / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        m = re.match(r'^([^#=\s][^=]*)=(.+)$', line.strip())
        if m:
            key, val = m.group(1).strip(), m.group(2).strip().strip("'\"")
            os.environ.setdefault(key, val)

# ─── Scale parameters ─────────────────────────────────────────────────────────

SCALE_PARAMS = {
    "PHQ-9":  {"rmin": 0, "rmax": 3},
    "GAD-7":  {"rmin": 0, "rmax": 3},
    "AAQ-II": {"rmin": 1, "rmax": 7},
    "MPFI":   {"rmin": 1, "rmax": 6},
    # default for custom: {"rmin": 1, "rmax": 5}
}

# ─── Questionnaire scoring ────────────────────────────────────────────────────

def compute_q_score(responses_df: pd.DataFrame, items_df: pd.DataFrame, scale_name: str) -> float:
    """
    responses_df: columns participant_id, item_id, raw_response_numeric
    items_df: columns id, is_reverse_scored, scoring_weight
    """
    p = SCALE_PARAMS.get(scale_name, {"rmin": 1, "rmax": 5})
    rmin, rmax = p["rmin"], p["rmax"]
    merged = responses_df.merge(
        items_df[["id", "is_reverse_scored", "scoring_weight"]],
        left_on="item_id", right_on="id", how="left"
    )
    merged["weight"] = merged["scoring_weight"].fillna(1)
    merged["scored"] = merged.apply(
        lambda r: (rmax + rmin - r["raw_response_numeric"]) * r["weight"] if r["is_reverse_scored"]
                  else r["raw_response_numeric"] * r["weight"],
        axis=1
    )
    return float(merged["scored"].sum())

# ─── Severity functions ───────────────────────────────────────────────────────
# Cutoffs matching lib/scales.ts (Kroenke 2001, Spitzer 2006, Bond 2011, Rolffs 2018)

def phq9_severity(score: float) -> tuple[str, str]:
    if score >= 20: return ("Severe", "severe")
    if score >= 15: return ("Moderately Severe", "moderately_severe")
    if score >= 10: return ("Moderate", "moderate")
    if score >= 5:  return ("Mild", "mild")
    return ("Minimal", "minimal")

def gad7_severity(score: float) -> tuple[str, str]:
    if score >= 15: return ("Severe", "severe")
    if score >= 10: return ("Moderate", "moderate")
    if score >= 5:  return ("Mild", "mild")
    return ("Minimal", "minimal")

def aaq2_severity(score: float) -> tuple[str, str]:
    # Bond et al. (2011) bands from scales.ts:
    # 7-17 → Flexible/minimal, 18-24 → Average/mild, 25-28 → Elevated/moderate, 29+ → High Inflexibility/severe
    if score >= 29: return ("High Inflexibility", "severe")
    if score >= 25: return ("Elevated", "moderate")
    if score >= 18: return ("Average", "mild")
    return ("Flexible", "minimal")

def mpfi_severity(score: float, n_items: int, rmax: int = 6) -> tuple[str, str]:
    # Rolffs et al. (2018) percentage-based
    pct = score / (n_items * rmax)
    if pct >= 0.51: return ("High Inflexibility", "severe")
    if pct >= 0.35: return ("Moderate", "moderate")
    return ("Low Inflexibility", "minimal")

def generic_severity(score: float, n_items: int, rmax: int = 5) -> tuple[str, str]:
    pct = score / (n_items * rmax)
    if pct >= 0.70: return ("Severe", "severe")
    if pct >= 0.40: return ("Moderate", "moderate")
    return ("Minimal", "minimal")

def get_severity(scale_name: str, score: float, n_items: int) -> tuple[str, str]:
    if scale_name == "PHQ-9":  return phq9_severity(score)
    if scale_name == "GAD-7":  return gad7_severity(score)
    if scale_name == "AAQ-II": return aaq2_severity(score)
    if scale_name == "MPFI":   return mpfi_severity(score, n_items, rmax=6)
    return generic_severity(score, n_items, rmax=5)

# ─── D2 algorithm (Greenwald, Nosek & Banaji, 2003) ──────────────────────────

def compute_d2(trials_df: pd.DataFrame, order_b: bool = False):
    """
    trials_df columns: block_number, response_time_ms, is_correct
    Returns: (d_score or None, excluded: bool, reason: str or None)
    """
    scoring = trials_df[trials_df["block_number"].isin([3, 4, 6, 7])].copy()

    if len(scoring) < 20:
        return None, True, f"Only {len(scoring)} scoring-block trials (need >=20)"

    # Cap at 10,000 ms
    scoring["rt"] = scoring["response_time_ms"].clip(upper=10_000)

    # Exclude if >10% faster than 300 ms
    fast_pct = (scoring["rt"] < 300).sum() / len(scoring)
    if fast_pct > 0.10:
        return None, True, f"{fast_pct:.1%} of trials < 300 ms"

    b34 = scoring[scoring["block_number"].isin([3, 4])].copy()
    b67 = scoring[scoring["block_number"].isin([6, 7])].copy()

    if len(b34) < 10 or len(b67) < 10:
        return None, True, "Fewer than 10 trials in a block pair"

    mc34 = b34.loc[b34["is_correct"], "rt"].mean()
    mc67 = b67.loc[b67["is_correct"], "rt"].mean()
    if pd.isna(mc34) or pd.isna(mc67):
        return None, True, "No correct trials in a block pair"

    # Error penalty: replace incorrect RT with mean_correct + 600 ms
    b34["rt_pen"] = b34.apply(lambda r: r["rt"] if r["is_correct"] else mc34 + 600, axis=1)
    b67["rt_pen"] = b67.apply(lambda r: r["rt"] if r["is_correct"] else mc67 + 600, axis=1)

    m34 = b34["rt_pen"].mean()
    m67 = b67["rt_pen"].mean()

    # Pooled SD — population SD (ddof=0), across ALL penalised scoring-block trials
    all_pen = pd.concat([b34["rt_pen"], b67["rt_pen"]])
    sd = all_pen.std(ddof=0)
    if sd == 0:
        return None, True, "Pooled SD = 0"

    raw_d = (m67 - m34) / sd
    d = -raw_d if order_b else raw_d
    return round(d, 4), False, None

# ─── Sociogram centrality ─────────────────────────────────────────────────────

def compute_sociogram_metrics(nominations_df: pd.DataFrame, all_auth_ids: list) -> dict:
    """
    nominations_df: columns nominator_id, nominee_id, score (auth UUIDs)
    """
    G = nx.DiGraph()
    G.add_nodes_from(all_auth_ids)
    for _, r in nominations_df.iterrows():
        G.add_edge(r["nominator_id"], r["nominee_id"], weight=float(r["score"] or 1))

    in_deg  = dict(G.in_degree())
    out_deg = dict(G.out_degree())
    betw    = nx.betweenness_centrality(G, normalized=True)
    close   = nx.closeness_centrality(G)
    try:
        eig = nx.eigenvector_centrality(G, max_iter=1000, tol=1e-6)
    except nx.PowerIterationFailedConvergence:
        eig = {v: 0.0 for v in G.nodes()}

    return {pid: {
        "indegree":    in_deg.get(pid, 0),
        "outdegree":   out_deg.get(pid, 0),
        "betweenness": round(betw.get(pid, 0), 5),
        "closeness":   round(close.get(pid, 0), 5),
        "eigenvector": round(eig.get(pid, 0), 5),
    } for pid in all_auth_ids}

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Crazy Sapiens — Wide CSV Export")
    print("Requires: pip install supabase pandas numpy networkx")
    print()

    parser = argparse.ArgumentParser(description="Export wide-format CSV from Crazy Sapiens study data.")
    parser.add_argument("--study", default=None, help="Study ID (UUID). Defaults to first study matching 'stress'.")
    parser.add_argument("--output", default="crazy_sapiens_wide.csv", help="Output CSV filename.")
    args = parser.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")

    sb = create_client(url, key)

    # ── Find study ────────────────────────────────────────────────────────────
    if args.study:
        study_id = args.study
        res = sb.table("studies").select("id,title").eq("id", study_id).single().execute()
        study = res.data
    else:
        res = sb.table("studies").select("id,title").ilike("title", "%stress%").limit(1).execute()
        study = res.data[0] if res.data else None
        if not study:
            res = sb.table("studies").select("id,title").order("created_at", desc=False).limit(1).execute()
            study = res.data[0] if res.data else None

    if not study:
        sys.exit("ERROR: No study found. Pass --study <uuid> explicitly.")

    study_id = study["id"]
    print(f"Study: {study['title']} ({study_id})")

    # ── Enrollments + profiles ────────────────────────────────────────────────
    enroll_res = sb.table("study_enrollments").select("participant_id,enrolled_at").eq("study_id", study_id).execute()
    enrollments = enroll_res.data or []
    participant_ids = [e["participant_id"] for e in enrollments]
    enrolled_at_map = {e["participant_id"]: e["enrolled_at"] for e in enrollments}

    if not participant_ids:
        print("No participants enrolled. Output will be empty.")
        participant_ids = []

    profiles = []
    if participant_ids:
        prof_res = sb.table("profiles").select(
            "id,full_name,email,gender,date_of_birth,education_level,occupation"
        ).in_("id", participant_ids).execute()
        profiles = prof_res.data or []

    profiles_map = {p["id"]: p for p in profiles}

    # ── Questionnaire instruments ─────────────────────────────────────────────
    q_instr_res = sb.table("questionnaire_instruments").select(
        "id,title,validated_scale_name"
    ).eq("study_id", study_id).execute()
    q_instruments = q_instr_res.data or []

    # ── IAT instruments ───────────────────────────────────────────────────────
    iat_instr_res = sb.table("iat_instruments").select(
        "id,title,iat_type"
    ).eq("study_id", study_id).execute()
    iat_instruments = iat_instr_res.data or []

    # ── Questionnaire items ───────────────────────────────────────────────────
    q_items_map: dict[str, pd.DataFrame] = {}
    for q in q_instruments:
        items_res = sb.table("questionnaire_items").select(
            "id,is_reverse_scored,scoring_weight"
        ).eq("questionnaire_id", q["id"]).eq("is_active", True).execute()
        q_items_map[q["id"]] = pd.DataFrame(items_res.data or [])

    # ── Questionnaire responses ───────────────────────────────────────────────
    q_responses_map: dict[str, pd.DataFrame] = {}
    for q in q_instruments:
        if participant_ids:
            resp_res = sb.table("questionnaire_item_responses").select(
                "participant_id,item_id,raw_response_numeric"
            ).eq("questionnaire_id", q["id"]).in_("participant_id", participant_ids).execute()
        else:
            resp_res = type("R", (), {"data": []})()
        q_responses_map[q["id"]] = pd.DataFrame(resp_res.data or [])

    # ── Stored questionnaire scores (for validation) ──────────────────────────
    stored_q_scores: dict[tuple, float] = {}
    for q in q_instruments:
        if participant_ids:
            stored_res = sb.table("questionnaire_scored_results").select(
                "participant_id,total_score"
            ).eq("questionnaire_id", q["id"]).in_("participant_id", participant_ids).execute()
            for row in (stored_res.data or []):
                if row["total_score"] is not None:
                    stored_q_scores[(row["participant_id"], q["id"])] = float(row["total_score"])

    # ── IAT trials ────────────────────────────────────────────────────────────
    iat_trials_map: dict[str, pd.DataFrame] = {}
    for iat in iat_instruments:
        if participant_ids:
            trials_res = sb.table("iat_trials").select(
                "participant_id,block_number,response_time_ms,is_correct"
            ).eq("iat_id", iat["id"]).in_("participant_id", participant_ids).execute()
        else:
            trials_res = type("R", (), {"data": []})()
        iat_trials_map[iat["id"]] = pd.DataFrame(trials_res.data or [])

    # ── Stored IAT session results (for validation) ───────────────────────────
    stored_iat_scores: dict[tuple, float] = {}
    for iat in iat_instruments:
        if participant_ids:
            stored_res = sb.table("iat_session_results").select(
                "participant_id,d_score,assigned_order"
            ).eq("iat_id", iat["id"]).in_("participant_id", participant_ids).execute()
            for row in (stored_res.data or []):
                if row["d_score"] is not None:
                    stored_iat_scores[(row["participant_id"], iat["id"])] = float(row["d_score"])

    # ── Sociogram nominations ─────────────────────────────────────────────────
    socio_res = sb.table("sociogram_nominations").select(
        "nominator_id,nominee_id,score"
    ).eq("study_id", study_id).execute()
    nominations_df = pd.DataFrame(socio_res.data or [])

    socio_metrics: dict[str, dict] = {}
    if participant_ids:
        socio_metrics = compute_sociogram_metrics(nominations_df, participant_ids)

    # ── Compute assigned_order for IAT sessions ───────────────────────────────
    iat_order_map: dict[tuple, bool] = {}  # (participant_id, iat_id) -> order_b
    for iat in iat_instruments:
        if participant_ids:
            sess_res = sb.table("iat_session_results").select(
                "participant_id,assigned_order"
            ).eq("iat_id", iat["id"]).in_("participant_id", participant_ids).execute()
            for row in (sess_res.data or []):
                order_b = (row.get("assigned_order") or "A") == "B"
                iat_order_map[(row["participant_id"], iat["id"])] = order_b

    # ── Build wide dataframe ──────────────────────────────────────────────────
    rows = []
    discrepancies = []

    for pid in participant_ids:
        prof = profiles_map.get(pid, {})
        enrolled_at = enrolled_at_map.get(pid)

        # Age
        dob = prof.get("date_of_birth")
        age_years = None
        if dob:
            try:
                dob_date = datetime.strptime(dob[:10], "%Y-%m-%d").date()
                today = date.today()
                age_years = (today - dob_date).days // 365
            except Exception:
                pass

        row: dict = {
            "participant_id":  pid,
            "full_name":       prof.get("full_name"),
            "email":           prof.get("email"),
            "gender":          prof.get("gender"),
            "date_of_birth":   dob,
            "age_years":       age_years,
            "education_level": prof.get("education_level"),
            "occupation":      prof.get("occupation"),
            "enrolled_at":     enrolled_at,
        }

        # Questionnaire scores
        for q in q_instruments:
            scale_name = q.get("validated_scale_name") or ""
            abbrev = scale_name.replace("-", "_").replace(" ", "_").lower() if scale_name else q["id"][:8]
            items_df = q_items_map.get(q["id"], pd.DataFrame())
            resp_df_all = q_responses_map.get(q["id"], pd.DataFrame())

            if not resp_df_all.empty:
                resp_df = resp_df_all[resp_df_all["participant_id"] == pid]
            else:
                resp_df = pd.DataFrame()

            if resp_df.empty or items_df.empty:
                row[f"{abbrev}_total"] = None
                row[f"{abbrev}_severity_label"] = None
                row[f"{abbrev}_severity_category"] = None
            else:
                computed = compute_q_score(resp_df, items_df, scale_name)
                n_items = len(items_df)
                label, category = get_severity(scale_name, computed, n_items)
                row[f"{abbrev}_total"] = computed
                row[f"{abbrev}_severity_label"] = label
                row[f"{abbrev}_severity_category"] = category

                # Validation
                stored = stored_q_scores.get((pid, q["id"]))
                if stored is not None and abs(computed - stored) > 0.02:
                    discrepancies.append(
                        f"  DISCREPANCY [{q['title']}] participant={pid}: computed={computed:.4f} stored={stored:.4f}"
                    )

        # IAT D-scores
        for iat in iat_instruments:
            slug = (iat.get("iat_type") or iat["id"][:8]).replace("-", "_")
            trials_df_all = iat_trials_map.get(iat["id"], pd.DataFrame())

            if not trials_df_all.empty:
                trials_df = trials_df_all[trials_df_all["participant_id"] == pid]
            else:
                trials_df = pd.DataFrame()

            if trials_df.empty:
                row[f"{slug}_d_score"] = None
                row[f"{slug}_excluded"] = None
                row[f"{slug}_excl_reason"] = None
            else:
                order_b = iat_order_map.get((pid, iat["id"]), False)
                d, excluded, reason = compute_d2(trials_df, order_b)
                row[f"{slug}_d_score"] = d
                row[f"{slug}_excluded"] = excluded
                row[f"{slug}_excl_reason"] = reason

                # Validation
                stored = stored_iat_scores.get((pid, iat["id"]))
                if stored is not None and d is not None and abs(d - stored) > 0.02:
                    discrepancies.append(
                        f"  DISCREPANCY [{iat['title']}] participant={pid}: computed={d:.4f} stored={stored:.4f}"
                    )

        # Sociogram
        sm = socio_metrics.get(pid, {})
        row["socio_indegree"]    = sm.get("indegree", 0)
        row["socio_outdegree"]   = sm.get("outdegree", 0)
        row["socio_betweenness"] = sm.get("betweenness", 0)
        row["socio_closeness"]   = sm.get("closeness", 0)
        row["socio_eigenvector"] = sm.get("eigenvector", 0)

        rows.append(row)

    df = pd.DataFrame(rows)
    df.to_csv(args.output, index=False)
    print(f"Wrote {len(df)} rows to {args.output}")

    # ── Validation report ─────────────────────────────────────────────────────
    print()
    if discrepancies:
        print("Validation warnings:")
        for d in discrepancies:
            print(d)
    else:
        print("All computed values match stored values")

if __name__ == "__main__":
    main()
