# Crazy Sapiens — Session Context File
_Last updated: 2026-04-21. Read this at the start of every new session._

---

## What this project is

A psychological research platform built in **Next.js 14 App Router** + **Supabase** (Postgres + Auth + RLS).

- **Researcher portal** (`app/(authenticated)/`) — create studies, add participants, view results
- **Participant portal** (`app/(participant)/`) — complete instruments assigned to them
- **Three instrument types**: Questionnaires (PHQ-9, GAD-7 etc.), Sociograms (peer nomination networks), IAT (Implicit Association Test — fixed Death/Suicide stimuli, Greenwald 2003 D2 algorithm)
- **GitHub**: `yasarsighed/Crazy-Sapiens` — deploys automatically to Vercel on push to `main`

---

## Tech stack

- Next.js 14 App Router (RSC + Client Components)
- Supabase (auth, RLS, Postgres)
- Tailwind CSS + shadcn/ui
- D3.js (CDN) for sociogram force-directed graph
- TypeScript throughout

---

## Current state of the codebase (as of last commit `acfa15a`)

### Files changed in this session (all pushed to main)

| File | What changed |
|---|---|
| `app/(authenticated)/studies/[id]/page.tsx` | Fixed 0 instruments bug (query 3 tables directly), add delete, Export CSV button wired |
| `app/(authenticated)/dashboard/page.tsx` | Admin sees all studies, fixed responses count, admin banner |
| `app/(authenticated)/studies/page.tsx` | Admin sees all studies with creator attribution |
| `app/(authenticated)/studies/[id]/questionnaire/[qid]/page.tsx` | Fixed `severity_band` → `severity_label`, added Acknowledge button, fetch alert `questionnaire_id` |
| `app/(authenticated)/studies/[id]/iat/[iid]/page.tsx` | **NEW** — researcher IAT results page (D-score dist, clinical flags ≥0.65, mean/SD) |
| `app/(authenticated)/studies/[id]/sociogram/page.tsx` | Replaced hardcoded demo with real DB data; dual-index nodes by both `id` and `participant_id` |
| `app/(authenticated)/audit-log/page.tsx` | **NEW** — live activity feed (was 404 — folder had leading space `/ auditlog`) |
| `app/(authenticated)/instruments/page.tsx` | Fixed broken `study_instruments` query → queries 3 tables directly |
| `app/(authenticated)/participants/page.tsx` | Per-study completion grid: check/circle per instrument, scores inline, alert count |
| `app/(participant)/layout.tsx` | Amber researcher context bar when researcher visits participant portal |
| `app/(participant)/participant/dashboard/page.tsx` | Groups pending instruments by study with study header |
| `app/(participant)/participant/iat/[iatid]/page.tsx` | Full rewrite: D2 algorithm, balanced trials, already-done guard, 12s save timeout |
| `app/(participant)/participant/questionnaire/[qid]/page.tsx` | Already-submitted guard on load |
| `app/(participant)/participant/sociogram/[sid]/page.tsx` | Self-nomination filter; enrollment error screen; pre-submit verification; uses auth UIDs for nominator/nominee_id |
| `app/api/export/[studyId]/route.ts` | **NEW** — CSV export API (questionnaire + IAT + sociogram data) |
| `app/api/alerts/route.ts` | **NEW** — POST endpoint to acknowledge clinical alerts |
| `components/acknowledge-alert-button.tsx` | **NEW** — client component for alert acknowledgment |

---

## Key architectural decisions

### Why `study_instruments` is bypassed everywhere
The `study_instruments` table has RLS policies that block reads. Every page that needs instruments queries `questionnaire_instruments`, `sociogram_instruments`, `iat_instruments` directly. The dialog components still write to `study_instruments` but this is marked non-fatal.

### Sociogram nominations use auth UIDs
`sociogram_nominations.nominator_id` and `nominee_id` have a FK to `auth.users(id)`. The code builds an `authIdBySocId` map (`sociogram_participants.id` → `participant_id` / auth UID) and passes auth UIDs when inserting. The researcher visualisation indexes nodes by both `id` and `participant_id` so old and new nominations both resolve.

### IAT D-score algorithm
Greenwald 2003 Algorithm D2:
- Cap RT > 10,000 ms
- Exclude if >10% of all B3+4+6+7 trials < 300 ms
- Error penalty: replace error RT with (block-pair correct mean + 600 ms)
- Pooled SD = SD of ALL B3+B4+B6+B7 penalized trials combined (NOT average of two SDs)
- D = (Mean_B67 − Mean_B34) / Pooled_SD
- Positive D = stronger Self–Death association

---

## Database — RLS policies confirmed applied in Supabase

```sql
-- questionnaire_item_responses
CREATE POLICY "participants_insert_item_responses" ON questionnaire_item_responses FOR INSERT WITH CHECK (participant_id = auth.uid());
CREATE POLICY "participants_update_item_responses" ON questionnaire_item_responses FOR UPDATE USING (participant_id = auth.uid());

-- questionnaire_scored_results
CREATE POLICY "participants_insert_scored_results" ON questionnaire_scored_results FOR INSERT WITH CHECK (participant_id = auth.uid());
CREATE POLICY "participants_update_scored_results" ON questionnaire_scored_results FOR UPDATE USING (participant_id = auth.uid()) WITH CHECK (participant_id = auth.uid());

-- clinical_alerts_log
CREATE POLICY "participants_insert_clinical_alerts" ON clinical_alerts_log FOR INSERT WITH CHECK (participant_id = auth.uid());
CREATE POLICY "researchers_acknowledge_alerts" ON clinical_alerts_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "researchers_read_alerts" ON clinical_alerts_log FOR SELECT USING (true);

-- iat_trial_log
CREATE POLICY "participants_insert_iat_trials" ON iat_trial_log FOR INSERT WITH CHECK (participant_id = auth.uid());
CREATE POLICY "researchers_read_iat_trials" ON iat_trial_log FOR SELECT USING (true);

-- iat_session_results (table was CREATED this session)
CREATE POLICY "participants_insert_iat_session_results" ON iat_session_results FOR INSERT WITH CHECK (participant_id = auth.uid());
CREATE POLICY "researchers_read_iat_session_results" ON iat_session_results FOR SELECT USING (true);

-- sociogram_participants
CREATE POLICY "participants_self_enroll_sociogram" ON sociogram_participants FOR INSERT WITH CHECK (participant_id = auth.uid());
-- participants_update_own_sociogram already existed before this session
CREATE POLICY "researchers_read_sociogram_participants" ON sociogram_participants FOR SELECT USING (true);

-- sociogram_nominations
CREATE POLICY "participants_insert_nominations" ON sociogram_nominations FOR INSERT WITH CHECK (true);
CREATE POLICY "researchers_read_nominations" ON sociogram_nominations FOR SELECT USING (true);
```

### Extra columns added to clinical_alerts_log
```sql
ALTER TABLE clinical_alerts_log
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
```

### iat_session_results table created this session
```sql
CREATE TABLE IF NOT EXISTS iat_session_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iat_id uuid NOT NULL REFERENCES iat_instruments(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  d_score numeric(6, 4),
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (iat_id, participant_id)
);
ALTER TABLE iat_session_results ENABLE ROW LEVEL SECURITY;
```

---

## Known dead weight (do not touch, already handled)

- `app/(authenticated)/ auditlog/page.tsx` — original folder with **leading space** still exists on disk; completely unreachable via any link. Can be deleted from file system but harmless to leave.
- `app/(authenticated)/analysis/page.tsx` — empty placeholder; sidebar still shows it.
- `app/(authenticated)/settings/page.tsx` — empty placeholder.
- `app/(authenticated)/supervisors/page.tsx` — empty placeholder.
- `study_instruments` table: still exists in DB; dialogs write to it; no page reads from it.

---

## Usability evaluation — issues found (prioritised)

### 🔴 Ethics blockers (must fix before ANY real participant use)
1. **No informed consent screen** — participants click "Begin" with no consent or explanation of data use
2. **IAT D-score shown to participants without debrief** — participants see "Strong Self–Death association" alone; causes distress; violates standard IAT administration protocol (Greenwald's own lab recommends against individual score reporting)
3. **No withdrawal mechanism** — participants cannot remove their data or leave a study

### 🟠 High priority UX
4. **IAT requires physical keyboard** — inaccessible on mobile; no warning shown on participant dashboard
5. **IAT cannot be paused/resumed** — if session interrupted, already-done guard blocks re-entry and data is lost
6. **Clinical alert acknowledgment has no follow-up capture** — no record of what action was taken after acknowledging
7. **No participant invitation link** — researcher must add participants one by one via modal search; impractical at scale
8. **Analysis page is a permanent empty stub** — creates false expectation in nav

### 🟡 Medium priority
9. **IAT stimuli are hardcoded** — every study gets the same Death/Suicide IAT; useless for other research questions
10. **CSV export is not analysis-ready** — SPSS/R need different formats; current CSV has `#` section markers
11. **No counterbalancing** — all participants see instruments in same fixed order
12. **PHQ-9 item 9 flag disappears if participant changes answer** — any endorsement above 0 should be permanently flagged
13. **No study-level completion acknowledgment** — participant has no "you've finished this study" moment
14. **Stub sidebar items** (Analysis, Settings, Supervisors) erode trust

### 🟢 Lower priority
15. Sociogram SVG has no ARIA labels (accessibility)
16. Severity encoding is colour-only (no text alternative for colour-blind users)
17. 9px font in sociogram sidebar (below WCAG minimum)
18. No global participant/result search
19. No study templates for common validated protocols

---

## What to work on next (suggested order)

1. **Consent screen** — per-study consent text configured by researcher; participant must accept before any instrument begins
2. **IAT debrief** — replace raw D-score display with researcher-configured debrief message; add IAT-specific context to prevent distress
3. **Participant withdrawal** — "Leave this study / delete my data" button on participant dashboard
4. **Mobile warning for IAT** — detect touch-only device and block/warn before IAT starts
5. **Participant invitation link** — generate enrolment URL/code per study; participant self-registers via link
6. **IAT stimuli configurable** — move word lists into `iat_instruments` DB table, editable in add-IAT dialog
7. **Clinical alert follow-up notes** — free-text field on acknowledge action; stored in `clinical_alerts_log`

---

## File structure snapshot

```
app/
  (authenticated)/
    audit-log/          ← NEW this session, works
     auditlog/          ← OLD dead folder with leading space — ignore
    analysis/           ← stub
    dashboard/
    instruments/        ← fixed this session
    participants/       ← major upgrade this session
    scale-library/
    settings/           ← stub
    studies/
      [id]/
        page.tsx        ← fixed this session
        iat/[iid]/      ← NEW this session
        questionnaire/[qid]/  ← fixed this session
        sociogram/      ← fixed this session
      new/
      page.tsx
    supervisors/        ← stub
    users/
    layout.tsx
  (participant)/
    layout.tsx          ← amber researcher bar added this session
    participant/
      dashboard/        ← grouping by study added this session
      iat/[iatid]/      ← full scientific rewrite this session
      questionnaire/[qid]/  ← already-submitted guard added
      sociogram/[sid]/  ← FK fix + enrollment error added
  api/
    alerts/route.ts     ← NEW this session
    export/[studyId]/route.ts  ← NEW this session
  login/ signup/ auth/

components/
  acknowledge-alert-button.tsx  ← NEW this session
  add-iat-dialog.tsx
  add-questionnaire-dialog.tsx
  add-sociogram-dialog.tsx
  sidebar.tsx
  ...

lib/
  supabase/client.ts + server.ts
  scales.ts   ← built-in scale defs (PHQ-9, GAD-7, etc.)
```
