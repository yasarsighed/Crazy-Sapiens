-- IAT schema migration — run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all statements are idempotent).
--
-- Adds columns that the app now sends but that may be missing from older
-- deployments. The DEFAULT values mean existing rows won't break.

-- ── iat_trial_log ─────────────────────────────────────────────────────────────

-- block_label: human-readable block name (e.g. "Practice — Self vs Other")
ALTER TABLE iat_trial_log
  ADD COLUMN IF NOT EXISTS block_label TEXT NOT NULL DEFAULT '';

-- block_type: structured category for analysis
--   'practice_target'    — block 1 (concept discrimination)
--   'practice_attribute' — block 2 (attribute discrimination)
--   'critical_practice'  — blocks 3 & 6 (combined, 20 trials, scored in D2)
--   'reversal_practice'  — block 5 (concept sides switched, unscored)
--   'critical_test'      — blocks 4 & 7 (combined, 40 trials, scored in D2)
ALTER TABLE iat_trial_log
  ADD COLUMN IF NOT EXISTS block_type TEXT NOT NULL DEFAULT 'practice';

-- ── iat_session_results ───────────────────────────────────────────────────────

-- assigned_order: counterbalancing condition ('A' or 'B')
--   Order A: compatible pairing first (blocks 3+4), incompatible second (blocks 6+7)
--   Order B: reversed. D-score is sign-corrected so positive D always means
--            stronger ConceptA–AttrA association regardless of order.
ALTER TABLE iat_session_results
  ADD COLUMN IF NOT EXISTS assigned_order TEXT;

-- excluded: whether this session was excluded from D2 scoring
--   (e.g. >10% of responses faster than 300 ms)
ALTER TABLE iat_session_results
  ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT FALSE;

-- exclusion_reason: human-readable explanation when excluded = true
ALTER TABLE iat_session_results
  ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;

-- ── iat_instruments ───────────────────────────────────────────────────────────

-- iat_type: key into the IAT type registry (lib/iat-types.ts)
--   death_suicide | gender_career | gender_science | hindu_muslim | modi
ALTER TABLE iat_instruments
  ADD COLUMN IF NOT EXISTS iat_type TEXT NOT NULL DEFAULT 'death_suicide';

CREATE INDEX IF NOT EXISTS idx_iat_instruments_iat_type
  ON iat_instruments (iat_type);
