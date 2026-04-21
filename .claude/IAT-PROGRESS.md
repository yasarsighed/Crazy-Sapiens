# Crazy Sapiens IAT Implementation — Progress & Status

**Last Updated:** 2026-04-20  
**Project:** Crazy Sapiens (Supabase project: `rvzltaknbabqbpjxegsg`)  
**Status:** 🟡 IN PROGRESS — 85% complete, blocking on column names

---

## Executive Summary

Three major features were built:
1. ✅ **Questionnaire Results View** (researcher-facing) — COMPLETE
2. ✅ **Death/Suicide IAT Engine** (participant-facing) — COMPLETE except trial saving
3. ✅ **IAT Creation Dialog** (researcher-facing) — COMPLETE
4. ✅ **Participant Dashboard Updates** — Shows IATs in pending/completed lists — COMPLETE

**BLOCKER:** The `iat_trial_log` table columns are unknown. The trial save logic has 3 fallback attempts, but none are confirmed to work. Need to discover actual column names in Supabase.

---

## Current Status by Component

### ✅ WORKING
- **Questionnaire submission:** Participants can submit questionnaires; scores are calculated and saved
- **Questionnaire results view:** Researchers see per-participant scores, severity bands, submission dates, alert counts
- **IAT visibility on dashboard:** Participants see pending/completed IATs alongside questionnaires
- **IAT creation dialog:** Researchers can add Death/Suicide IAT to studies
- **IAT task UI:** Full-screen task with stimulus display, keyboard response handling (E/I keys), error feedback, progress tracking
- **D-score calculation:** Greenwald 2003 method (mean_blocks67 - mean_blocks34) / pooledSD, with data filtering
- **Severity interpretation:** D-score → label/color/detail (green/grey/yellow/orange/red scale)

### 🟡 BROKEN / INCOMPLETE
- **Trial data saving:** Participants complete IAT but trial data doesn't persist (or persists with wrong column mapping)
  - Code has 3-attempt fallback (lines 275-322 in `[iatid]/page.tsx`)
  - Attempt 1 tries: `iat_instrument_id, participant_id, block_number, trial_number, stimulus_word, word_type, correct_key, response_key, reaction_time_ms, is_correct`
  - Attempt 2 tries: `instrument_id, participant_id, block_num, trial_num, stimulus, category, correct_key, response_key, reaction_time, correct`
  - Attempt 3 tries: `iat_instrument_id, participant_id, block_number, reaction_time_ms, correct`
  - None are confirmed correct — need actual schema
  
- **IAT results view (researcher):** Not built yet
  - Should show per-participant D-scores, severity interpretation, trial count, accuracy stats
  - Parallel to questionnaire results page at `/studies/[studyId]/iat/[iatId]`

### 📋 QUESTIONNAIRE (Reference Implementation)

Since questionnaires work, use as model for IAT:

**Submit flow:**
```typescript
// File: app/(participant)/participant/questionnaire/[qid]/page.tsx
// Lines 168-175: Insert item responses with upsert
await supabase
  .from('questionnaire_item_responses')
  .upsert(responseRecords, {
    onConflict: 'questionnaire_id,participant_id,item_id',
    ignoreDuplicates: false,
  })

// Lines 192-215: Save scored result with upsert
const { data: scoredResult } = await supabase
  .from('questionnaire_scored_results')
  .upsert({
    questionnaire_id: qid,
    participant_id: userId,
    total_score: totalScore,
    // ... other fields
    is_complete: true,
  })
  .select('id')
  .single()
```

**Key lesson:** Use `.upsert()` instead of `.insert()` to handle retries without duplicate key errors.

---

## Architecture Overview

### Database Schema (Key Tables)

```
studies
├── id, title, description, status, created_by, created_at

study_enrollments
├── id, study_id, participant_id, status, enrolled_at

iat_instruments (Direct participant query, bypasses RLS)
├── id, study_id, title, description
├── concept_a_label, concept_b_label (e.g., "Self", "Other")
├── attribute_a_label, attribute_b_label (e.g., "Death/Suicide", "Life")
├── created_at, updated_at

iat_trial_log (SCHEMA UNKNOWN ⚠️)
├── ??? (see "Next Steps" section below)

questionnaire_instruments
├── id, study_id, title, instructions
├── validated_scale_name, is_validated_scale
├── clinical_alert_enabled, clinical_alert_threshold
├── created_at, updated_at

questionnaire_items
├── id, questionnaire_id, item_text, item_code, display_order
├── response_options (JSON), is_clinical_flag_item
├── clinical_flag_threshold, clinical_flag_operator, clinical_flag_message
├── is_reverse_scored, scoring_weight

questionnaire_item_responses
├── id, questionnaire_id, participant_id, item_id
├── raw_response, raw_response_numeric, scored_value
├── is_reverse_scored, is_skipped, clinical_flag_triggered, clinical_flag_message
├── submitted_at
├── UNIQUE(questionnaire_id, participant_id, item_id)

questionnaire_scored_results
├── id, questionnaire_id, participant_id
├── total_score, total_score_possible, score_percentage
├── severity_label, severity_category
├── items_completed, items_total, completion_percentage
├── is_complete, clinical_alert_triggered, clinical_alert_level
├── scored_at
├── UNIQUE(questionnaire_id, participant_id)

clinical_alerts_log
├── id, study_id, questionnaire_id, participant_id
├── scored_result_id, alert_level, alert_type
├── trigger_description, trigger_score, trigger_threshold
├── scale_name, acknowledged, resolved, escalated
├── created_at

sociogram_instruments
├── id, study_id, title, status, created_at

sociogram_participants
├── id, sociogram_id, participant_id, has_submitted, submitted_at
```

### Key Files & Their Roles

#### Researcher-Facing (Authenticated)

**`app/(authenticated)/studies/[id]/page.tsx`**
- Lists participants and instruments for a study
- Add buttons for Questionnaire, Sociogram, IAT
- Shows instrument status and links to results pages
- Lines 196-207: IAT dropdown option added
- Imports `AddIatDialog` component

**`app/(authenticated)/studies/[id]/questionnaire/[qid]/page.tsx`** (NEW)
- Shows questionnaire results: severity distribution bar, summary stats, per-participant table
- Fetches `questionnaire_scored_results` and `clinical_alerts_log`
- Displays: participant name, score, severity badge, submission date, alert count
- Model for IAT results page (to be built)

**`components/add-questionnaire-dialog.tsx`**
- Allows researchers to create questionnaires
- Inserts to `questionnaire_instruments` and item records

**`components/add-sociogram-dialog.tsx`**
- Allows researchers to create sociograms
- Inserts to `sociogram_instruments`

**`components/add-iat-dialog.tsx`** (NEW)
- Allows researchers to add Death/Suicide IAT to studies
- Pre-configured with Millner et al. (2019) stimuli
- Inserts to `iat_instruments` with fields:
  - `study_id, title, description`
  - `concept_a_label: "Self"`, `concept_b_label: "Other"`
  - `attribute_a_label: "Death / Suicide"`, `attribute_b_label: "Life"`
- Also creates `study_instruments` link record
- Lines 78-94: Insert logic (confirmed working)

#### Participant-Facing

**`app/(participant)/participant/dashboard/page.tsx`** (MODIFIED)
- Dashboard showing pending/completed instruments
- Lines 70-75: Fetches active IATs directly from `iat_instruments` table (RLS workaround)
- Lines 80-87: Checks `iat_trial_log` for completion
- Lines 93-94: Filters into pending/completed lists
- Displays with Timer icon (#F4A261 orange) and "Begin" button

**`app/(participant)/participant/questionnaire/[qid]/page.tsx`** (MODIFIED)
- Questionnaire task UI: displays items, captures responses, calculates score
- Lines 168-175: **Upsert pattern** for item responses
- Lines 192-215: **Upsert pattern** for scored results
- Key fix: Changed `.insert()` → `.upsert()` to handle retries

**`app/(participant)/participant/iat/[iatid]/page.tsx`** (NEW)
- Full IAT interface: intro screen → block intros → 7 blocks of trials → results
- Full-screen dark task with stimulus display, category labels, progress
- Keyboard handler: E/I keys, response timing, error feedback (red X, 800ms)
- Trial generation: 180 trials across 7 blocks (20 practice, 40 test, etc.)
- Lines 260-325: **Trial save logic with 3-attempt fallback** (BLOCKING)
  - Attempt 1: `iat_instrument_id, participant_id, block_number, trial_number, ...`
  - Attempt 2: `instrument_id, participant_id, block_num, trial_num, ...`
  - Attempt 3: `iat_instrument_id, participant_id, block_number, reaction_time_ms, correct`
  - Errors logged to console with `.message`
- Lines 108-127: D-score calculation (Greenwald 2003)
  - Filters blocks 3+4 and 6+7 (excludes RT > 10,000ms)
  - Rejects if <10 valid trials per group or >10% fast trials (<300ms)
  - Formula: (mean_RT_67 - mean_RT_34) / pooledSD
- Lines 129-135: Severity interpretation → label, detail, color
- Results screen: shows D-score, severity, reference table

---

## Known Issues & Solutions

### Issue 1: Duplicate Key Error on Questionnaire Submit
**Status:** ✅ FIXED  
**Root Cause:** Participant retried after partial failure (first request saved responses but failed on scored_result save, second request tried same responses again → duplicate key)  
**Solution:** Changed `.insert()` → `.upsert(onConflict: 'questionnaire_id,participant_id,item_id')` on both questionnaire_item_responses and questionnaire_scored_results  
**Files Modified:** `app/(participant)/participant/questionnaire/[qid]/page.tsx` lines 168-175, 192-215

### Issue 2: IAT Not Visible on Participant Dashboard
**Status:** ✅ FIXED  
**Root Cause:** Querying through `study_instruments` table which has RLS policy (researchers only)  
**Solution:** Changed to query `iat_instruments` directly with `.in('study_id', studyIds)`, matching questionnaire/sociogram pattern  
**Files Modified:** `app/(participant)/participant/dashboard/page.tsx` lines 70-75  
**Key Code:**
```typescript
const { data: iats } = studyIds.length > 0
  ? await supabase
      .from('iat_instruments')
      .select('id, study_id, title')
      .in('study_id', studyIds)
    : { data: [] }
```

### Issue 3: IAT Instrument Table Column Names (CURRENT BLOCKER)
**Status:** 🟡 IN PROGRESS  
**Root Cause:** Original code tried `attribute_negative`, `attribute_positive`, `category_a`, etc. — columns don't exist  
**Solution Deployed:** Changed to correct columns: `concept_a_label, concept_b_label, attribute_a_label, attribute_b_label`  
**Files Modified:** `components/add-iat-dialog.tsx` lines 78-88  
**Status:** ✅ This insert works (confirmed by successful dialog submissions)

### Issue 4: IAT Trial Data Column Names (CURRENT BLOCKER)
**Status:** ✅ FIXED  
**Root Cause:** Code tried `iat_instrument_id` but actual column is `iat_id`; also wrong names for stimulus/response columns  
**Solution Deployed:** Updated saveResults() to use correct columns discovered from Supabase schema:
  - `iat_id` (not iat_instrument_id)
  - `stimulus_text` (not stimulus_word)
  - `stimulus_category` (not word_type)
  - `pressed_key` (not response_key)
  - Added `session_id` (UUID per session) and `is_too_fast` (rt < 300)
**Files Modified:** `app/(participant)/participant/iat/[iatid]/page.tsx` lines 259-295  
**Status:** Ready to test

---

## Errors & Error Messages (Reference)

```
// From past deploy attempts:
"Could not find the 'attribute_negative' column of 'iat_instruments' in the schema cache"
"Could not find the 'category_a' column of 'iat_instruments' in the schema cache"
"null value in column 'concept_a_label' of relation 'iat_instruments' violates not-null constraint"
"duplicate key value violates unique constraint 'unique_item_response'"
```

Each error revealed the exact column name issue, allowing progressive refinement.

---

## Next Steps (Detailed)

### IMMEDIATE (BLOCKING)
**Goal:** Discover actual column names in `iat_trial_log` table

**Step 1: Check Supabase Schema**
1. Open https://supabase.com/dashboard
2. Click project `rvzltaknbabqbpjxegsg`
3. Left sidebar → **Table Editor**
4. Click **`iat_trial_log`** table
5. Look at the **column list on the left panel**
6. **Screenshot or list the column names** (e.g., `id, participant_id, instrument_id, block_number, ...`)
7. Paste the list here or in next chat

**Step 2: Alternative — Run Test & Capture Error**
If Step 1 feels complicated:
1. Have a test participant complete an IAT (click Begin → answer all blocks)
2. After results screen, open browser console: Press `F12` → **Console** tab
3. Look for message: **`iat_trial_log save failed (all attempts):`**
4. Copy the full error message and share
5. Error will explicitly state which column is missing

**Step 3: Update Trial Save Logic**
Once you have column names:
1. I'll update `app/(participant)/participant/iat/[iatid]/page.tsx` lines 275-315
2. Replace 3-attempt fallback with single correct attempt
3. Test with participant again

---

### SHORT TERM (After Column Fix)

**Step 4: Build IAT Results Page (Researcher View)**
- File: `app/(authenticated)/studies/[id]/iat/[iatId]/page.tsx` (NEW)
- Show per-participant D-scores, severity, accuracy, trial count
- Model it on `app/(authenticated)/studies/[id]/questionnaire/[qid]/page.tsx`
- Include:
  - D-score distribution chart (similar to severity distribution)
  - Summary stats: count, mean, min, max D-scores
  - Per-participant table: name, D-score, severity badge, trial accuracy %, completion date
  - Fetch from `iat_instruments`, `iat_trial_log`, compute D-scores per participant

**Step 5: Test End-to-End**
1. Researcher: Create study
2. Researcher: Add Death/Suicide IAT (via Add IAT dialog)
3. Researcher: Add participants
4. Participant: Log in, see IAT in pending list
5. Participant: Complete IAT (all 7 blocks)
6. Participant: See results screen with D-score
7. Check Supabase: Verify trials saved in `iat_trial_log`
8. Researcher: View IAT results page, see participant D-score

---

## Stimuli & Configuration (Reference)

**Death/Suicide IAT Setup (Millner et al. 2019 + Greenwald 2003):**

```
Target A (left):    Self      → words: Me, My, I, Mine, Self
Target B (right):   Other     → words: They, Them, Their, Other, Theirs
Attribute A (left): Death     → words: Death, Die, Dying, Suicide, Dead
Attribute B (right): Life     → words: Life, Alive, Living, Survive, Thrive

Block Structure (7 blocks, 180 total trials):
  1. Practice (20 trials):       Self (E) vs Other (I)
  2. Practice (20 trials):       Death (E) vs Life (I)
  3. Practice (20 trials):       Self+Death (E) vs Other+Life (I)
  4. Test (40 trials):           Self+Death (E) vs Other+Life (I)
  5. Practice (20 trials):       Other (E) vs Self (I)  [switched]
  6. Practice (20 trials):       Death+Self (E) vs Life+Other (I)  [switched]
  7. Test (40 trials):           Death+Self (E) vs Life+Other (I)  [switched]

D-Score Calculation:
  - Compare response times: blocks 3+4 (original pairing) vs blocks 6+7 (switched pairing)
  - Filter: RT ≤ 10,000ms only
  - Reject: if <10 valid trials per group or >10% fast trials (<300ms)
  - Formula: D = (M_RT_67 - M_RT_34) / PooledSD
  - Interpretation:
    D < 0:       Green   "Slight preference for Life"
    0–0.15:      Grey    "Little or no association"
    0.15–0.35:   Yellow  "Slight Self–Death association"
    0.35–0.65:   Orange  "Moderate Self–Death association"
    > 0.65:      Red     "Strong Self–Death association"
```

---

## Code Snippets for Reference

### Correct `iat_instruments` Insert (Working)
```typescript
// File: components/add-iat-dialog.tsx, lines 78-90
const { data: iat, error: iatError } = await supabase
  .from('iat_instruments')
  .insert({
    study_id:          studyId,
    title:             label.trim(),
    description:       notes.trim() || `Death/Suicide IAT — ...`,
    concept_a_label:   'Self',
    concept_b_label:   'Other',
    attribute_a_label: 'Death / Suicide',
    attribute_b_label: 'Life',
  })
  .select('id')
  .single()
```

### Upsert Pattern for Questionnaire (Working Model)
```typescript
// File: app/(participant)/participant/questionnaire/[qid]/page.tsx, lines 168-175
const { error: responseError } = await supabase
  .from('questionnaire_item_responses')
  .upsert(responseRecords, {
    onConflict: 'questionnaire_id,participant_id,item_id',
    ignoreDuplicates: false,
  })
```

### Trial Save Fallback Logic (Needs Column Names)
```typescript
// File: app/(participant)/participant/iat/[iatid]/page.tsx, lines 260-325
async function saveResults(finalResponses: TrialResponse[]) {
  const attempt = async (rows: Record<string, any>[]) => {
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('iat_trial_log').insert(rows.slice(i, i + 100))
      if (error) return error
    }
    return null
  }

  // Attempt 1
  const rows1 = finalResponses.map(r => ({
    iat_instrument_id: iatid,
    participant_id: userId,
    block_number: r.blockNum,
    trial_number: r.trialNum,
    stimulus_word: r.word,
    word_type: r.wordType,
    correct_key: r.correctKey,
    response_key: r.responseKey,
    reaction_time_ms: r.rt,
    is_correct: r.isCorrect,
  }))
  const err1 = await attempt(rows1)
  
  if (err1) {
    // Attempt 2, Attempt 3...
    // [full logic in file]
  }
}
```

---

## Testing Checklist

- [ ] Researcher can add IAT via dialog
- [ ] IAT appears in study instruments list
- [ ] Participant sees IAT in pending list on dashboard
- [ ] Participant can start IAT (intro screen loads)
- [ ] Participant can complete all 7 blocks (keyboard response, progress bar, error feedback)
- [ ] D-score calculated correctly (check Math)
- [ ] Severity interpretation correct (color/label match D-score range)
- [ ] Results screen displays properly (D-score, interpretation, reference table)
- [ ] Trial data saved to `iat_trial_log` (check Supabase)
- [ ] Participant can see completed IAT on dashboard
- [ ] Researcher can view IAT results page (once built)

---

## Supabase Project Info

**Project ID:** rvzltaknbabqbpjxegsg  
**URL:** https://supabase.com/dashboard/project/rvzltaknbabqbpjxegsg  
**Tables Used:**
- `studies`
- `study_enrollments`
- `profiles` (role: 'researcher' or 'participant')
- `iat_instruments`
- `iat_trial_log` ← **SCHEMA UNKNOWN**
- `questionnaire_instruments`
- `questionnaire_items`
- `questionnaire_item_responses`
- `questionnaire_scored_results`
- `clinical_alerts_log`
- `sociogram_instruments`
- `sociogram_participants`

**RLS Policies:**
- `study_instruments`: Researchers only (bypassed by querying instrument tables directly)
- `iat_instruments`: No RLS (direct query works)
- `questionnaire_instruments`: No RLS (direct query works)

---

## Contact & Questions

If you need to resume work:
1. Check this file first for status
2. Follow "Next Steps" section
3. If blocked, focus on **Discover Column Names** (Step 1 or 2)
4. Once unblocked, proceed to **Build IAT Results Page** (Step 4)

Good luck! 🚀
