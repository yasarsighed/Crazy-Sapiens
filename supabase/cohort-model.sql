-- ═══════════════════════════════════════════════════════════════════════════
-- Cohort model migration
-- Paste in Supabase SQL editor (safe to run multiple times — all IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cohorts — named participant pools with a shared baseline battery
CREATE TABLE IF NOT EXISTS cohorts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('draft', 'active', 'archived')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Cohort members — participants enrolled in a cohort
CREATE TABLE IF NOT EXISTS cohort_members (
  cohort_id              UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  participant_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at            TIMESTAMPTZ DEFAULT NOW(),
  baseline_completed_at  TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'withdrawn')),
  PRIMARY KEY (cohort_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_cohort_members_participant ON cohort_members(participant_id);

-- 3. Researcher access to cohorts (granted by admin)
CREATE TABLE IF NOT EXISTS cohort_researcher_access (
  cohort_id      UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  researcher_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  access_level   TEXT NOT NULL DEFAULT 'view'
                 CHECK (access_level IN ('view', 'contribute')),
  granted_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cohort_id, researcher_id)
);

-- 4. Platform requests — approval workflow (the PI / admin is the single authority)
--    request_type:
--      cohort_access   — researcher wants access to an existing cohort
--      cohort_creation — researcher wants a new cohort created
--      study_approval  — researcher submits study for PI review before activation
CREATE TABLE IF NOT EXISTS platform_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  request_type  TEXT NOT NULL
                CHECK (request_type IN ('cohort_access', 'cohort_creation', 'study_approval')),
  entity_type   TEXT,           -- 'cohort' | 'study' | null
  entity_id     UUID,           -- id of the cohort or study being referenced
  payload       JSONB DEFAULT '{}', -- free-form context (requested access_level, notes, etc.)
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_requests_status    ON platform_requests(status);
CREATE INDEX IF NOT EXISTS idx_platform_requests_requester ON platform_requests(requester_id);

-- 5. Link studies to cohorts (optional — null means standalone study)
ALTER TABLE studies ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_studies_cohort ON studies(cohort_id);

-- 6. Gender + socio-demographic fields on profiles (needed for baseline battery)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth    DATE,
  ADD COLUMN IF NOT EXISTS gender           TEXT,
  ADD COLUMN IF NOT EXISTS education_level  TEXT,
  ADD COLUMN IF NOT EXISTS occupation       TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT;

-- 7. RLS policies — cohorts visible to admin always; researchers see only their accessible ones
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cohorts_admin_all') THEN
    CREATE POLICY cohorts_admin_all ON cohorts FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cohorts_researcher_view') THEN
    CREATE POLICY cohorts_researcher_view ON cohorts FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('researcher','supervisor'))
        AND (
          created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM cohort_researcher_access WHERE cohort_id = cohorts.id AND researcher_id = auth.uid())
        )
      );
  END IF;
END $$;

ALTER TABLE platform_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'requests_admin_all') THEN
    CREATE POLICY requests_admin_all ON platform_requests FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'requests_own') THEN
    CREATE POLICY requests_own ON platform_requests FOR ALL
      USING (requester_id = auth.uid());
  END IF;
END $$;
