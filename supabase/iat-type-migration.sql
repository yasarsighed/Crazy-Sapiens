-- ─── IAT type column ─────────────────────────────────────────────────────────
-- Adds the iat_type column to iat_instruments so each instrument knows which
-- IAT variant it represents (death_suicide, gender_career, gender_science,
-- gender_valence, hindu_muslim, modi_pm).
--
-- Safe to run multiple times — uses IF NOT EXISTS.
-- Default 'death_suicide' keeps all pre-existing instruments intact.

ALTER TABLE iat_instruments
  ADD COLUMN IF NOT EXISTS iat_type TEXT NOT NULL DEFAULT 'death_suicide';

-- Optional: add a check constraint to restrict to known types.
-- Comment this out if you expect to add new types frequently.
-- ALTER TABLE iat_instruments
--   ADD CONSTRAINT iat_instruments_iat_type_check
--   CHECK (iat_type IN (
--     'death_suicide', 'gender_career', 'gender_science',
--     'gender_valence', 'hindu_muslim', 'modi_pm'
--   ));

-- Index for quick look-up when filtering results by type.
CREATE INDEX IF NOT EXISTS idx_iat_instruments_iat_type
  ON iat_instruments (iat_type);
