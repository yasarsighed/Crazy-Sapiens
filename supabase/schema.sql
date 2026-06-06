-- ═══════════════════════════════════════════════════════════════════════════
-- Crazy Sapiens — Complete Database Schema
-- Run this in the Supabase SQL editor on a fresh project.
-- Safe to run multiple times — all CREATE statements use IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES ─────────────────────────────────────────────────────────────
-- Mirrors auth.users; one row per authenticated user.
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  full_name        TEXT,
  role             TEXT NOT NULL DEFAULT 'participant'
                   CHECK (role IN ('participant', 'researcher', 'supervisor', 'admin')),
  researcher_color TEXT,
  avatar_url       TEXT,
  date_of_birth    DATE,
  gender           TEXT,
  education_level  TEXT,
  occupation       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

-- Auto-create a profile row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'participant')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_admin_all') THEN
    CREATE POLICY profiles_admin_all ON public.profiles FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_researcher_select') THEN
    CREATE POLICY profiles_researcher_select ON public.profiles FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('researcher','supervisor','admin')));
  END IF;
END $$;


-- ─── 2. STUDIES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.studies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consent_text TEXT,
  start_date   DATE,
  end_date     DATE,
  cohort_id    UUID,  -- FK to cohorts added after cohorts table is created
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_studies_created_by ON public.studies(created_by);
CREATE INDEX IF NOT EXISTS idx_studies_status     ON public.studies(status);

ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='studies' AND policyname='studies_researcher_own') THEN
    CREATE POLICY studies_researcher_own ON public.studies FOR ALL
      USING (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='studies' AND policyname='studies_admin_all') THEN
    CREATE POLICY studies_admin_all ON public.studies FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='studies' AND policyname='studies_participant_select') THEN
    CREATE POLICY studies_participant_select ON public.studies FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.study_enrollments se
        WHERE se.study_id = studies.id AND se.participant_id = auth.uid()
      ));
  END IF;
END $$;


-- ─── 3. STUDY ENROLLMENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_enrollments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id       UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('invited', 'active', 'enrolled', 'completed', 'withdrawn')),
  enrolled_at    TIMESTAMPTZ DEFAULT NOW(),
  consented_at   TIMESTAMPTZ,
  UNIQUE (study_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_study_enrollments_participant ON public.study_enrollments(participant_id);
CREATE INDEX IF NOT EXISTS idx_study_enrollments_study       ON public.study_enrollments(study_id);

ALTER TABLE public.study_enrollments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_enrollments' AND policyname='enrollments_participant_own') THEN
    CREATE POLICY enrollments_participant_own ON public.study_enrollments FOR SELECT
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_enrollments' AND policyname='enrollments_participant_update') THEN
    CREATE POLICY enrollments_participant_update ON public.study_enrollments FOR UPDATE
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_enrollments' AND policyname='enrollments_researcher_select') THEN
    CREATE POLICY enrollments_researcher_select ON public.study_enrollments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_enrollments' AND policyname='enrollments_admin_all') THEN
    CREATE POLICY enrollments_admin_all ON public.study_enrollments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 4. STUDY INSTRUMENTS ────────────────────────────────────────────────────
-- Junction table linking studies to their instruments (questionnaire/iat/sociogram)
CREATE TABLE IF NOT EXISTS public.study_instruments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id        UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  instrument_type TEXT NOT NULL CHECK (instrument_type IN ('questionnaire', 'iat', 'sociogram')),
  instrument_id   UUID NOT NULL,
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_id, instrument_type, instrument_id)
);
CREATE INDEX IF NOT EXISTS idx_study_instruments_study ON public.study_instruments(study_id);

ALTER TABLE public.study_instruments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_instruments' AND policyname='study_instruments_researcher') THEN
    CREATE POLICY study_instruments_researcher ON public.study_instruments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.created_by = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_instruments' AND policyname='study_instruments_participant_select') THEN
    CREATE POLICY study_instruments_participant_select ON public.study_instruments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.study_enrollments se WHERE se.study_id = study_instruments.study_id AND se.participant_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_instruments' AND policyname='study_instruments_admin_all') THEN
    CREATE POLICY study_instruments_admin_all ON public.study_instruments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 5. QUESTIONNAIRE INSTRUMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questionnaire_instruments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id                  UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  researcher_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title                     TEXT NOT NULL,
  instructions              TEXT,
  description               TEXT,
  validated_scale_name      TEXT,
  is_validated_scale        BOOLEAN NOT NULL DEFAULT FALSE,
  clinical_alert_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  clinical_alert_threshold  INTEGER,
  estimated_duration_minutes INTEGER,
  auto_score                BOOLEAN NOT NULL DEFAULT FALSE,
  status                    TEXT NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_questionnaire_instruments_study ON public.questionnaire_instruments(study_id);

ALTER TABLE public.questionnaire_instruments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_instruments' AND policyname='qi_researcher_own') THEN
    CREATE POLICY qi_researcher_own ON public.questionnaire_instruments FOR ALL
      USING (researcher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_instruments' AND policyname='qi_participant_select') THEN
    CREATE POLICY qi_participant_select ON public.questionnaire_instruments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.study_enrollments se WHERE se.study_id = questionnaire_instruments.study_id AND se.participant_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_instruments' AND policyname='qi_admin_all') THEN
    CREATE POLICY qi_admin_all ON public.questionnaire_instruments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 6. QUESTIONNAIRE ITEMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questionnaire_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id        UUID NOT NULL REFERENCES public.questionnaire_instruments(id) ON DELETE CASCADE,
  item_text               TEXT NOT NULL,
  item_code               TEXT,
  display_order           INTEGER NOT NULL DEFAULT 0,
  response_options        JSONB,  -- [{value: number, label: string}]
  is_reverse_scored       BOOLEAN NOT NULL DEFAULT FALSE,
  scoring_weight          NUMERIC,
  is_clinical_flag_item   BOOLEAN NOT NULL DEFAULT FALSE,
  clinical_flag_threshold INTEGER,
  clinical_flag_operator  TEXT,   -- 'gte' | 'lte' | 'eq' etc.
  clinical_flag_message   TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_questionnaire_items_questionnaire ON public.questionnaire_items(questionnaire_id);

ALTER TABLE public.questionnaire_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_items' AND policyname='qitems_researcher_select') THEN
    CREATE POLICY qitems_researcher_select ON public.questionnaire_items FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.questionnaire_instruments qi WHERE qi.id = questionnaire_id AND qi.researcher_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_items' AND policyname='qitems_participant_select') THEN
    CREATE POLICY qitems_participant_select ON public.questionnaire_items FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.questionnaire_instruments qi
        JOIN public.study_enrollments se ON se.study_id = qi.study_id
        WHERE qi.id = questionnaire_items.questionnaire_id AND se.participant_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_items' AND policyname='qitems_admin_all') THEN
    CREATE POLICY qitems_admin_all ON public.questionnaire_items FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 7. QUESTIONNAIRE ITEM RESPONSES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questionnaire_item_responses (
  questionnaire_id        UUID NOT NULL REFERENCES public.questionnaire_instruments(id) ON DELETE CASCADE,
  participant_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id                 UUID NOT NULL REFERENCES public.questionnaire_items(id) ON DELETE CASCADE,
  raw_response            TEXT,
  raw_response_numeric    NUMERIC,
  scored_value            NUMERIC,
  is_reverse_scored       BOOLEAN NOT NULL DEFAULT FALSE,
  is_skipped              BOOLEAN NOT NULL DEFAULT FALSE,
  clinical_flag_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  clinical_flag_message   TEXT,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (questionnaire_id, participant_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_qir_participant ON public.questionnaire_item_responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_qir_questionnaire ON public.questionnaire_item_responses(questionnaire_id);

ALTER TABLE public.questionnaire_item_responses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_item_responses' AND policyname='qir_participant_own') THEN
    CREATE POLICY qir_participant_own ON public.questionnaire_item_responses FOR ALL
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_item_responses' AND policyname='qir_researcher_select') THEN
    CREATE POLICY qir_researcher_select ON public.questionnaire_item_responses FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.questionnaire_instruments qi WHERE qi.id = questionnaire_id AND qi.researcher_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_item_responses' AND policyname='qir_admin_all') THEN
    CREATE POLICY qir_admin_all ON public.questionnaire_item_responses FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 8. QUESTIONNAIRE SCORED RESULTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questionnaire_scored_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id  UUID NOT NULL REFERENCES public.questionnaire_instruments(id) ON DELETE CASCADE,
  participant_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_score       NUMERIC,
  severity_label    TEXT,
  severity_category TEXT,
  is_complete       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (questionnaire_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_qsr_participant ON public.questionnaire_scored_results(participant_id);

ALTER TABLE public.questionnaire_scored_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_scored_results' AND policyname='qsr_participant_own') THEN
    CREATE POLICY qsr_participant_own ON public.questionnaire_scored_results FOR ALL
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_scored_results' AND policyname='qsr_researcher_select') THEN
    CREATE POLICY qsr_researcher_select ON public.questionnaire_scored_results FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.questionnaire_instruments qi WHERE qi.id = questionnaire_id AND qi.researcher_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questionnaire_scored_results' AND policyname='qsr_admin_all') THEN
    CREATE POLICY qsr_admin_all ON public.questionnaire_scored_results FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 9. CLINICAL ALERTS LOG ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_alerts_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id            UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  participant_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  questionnaire_id    UUID REFERENCES public.questionnaire_instruments(id) ON DELETE CASCADE,
  scored_result_id    UUID REFERENCES public.questionnaire_scored_results(id) ON DELETE SET NULL,
  severity            TEXT CHECK (severity IN ('critical', 'moderate', 'low')),
  alert_level         TEXT,
  alert_type          TEXT,
  message             TEXT,
  trigger_description TEXT,
  trigger_score       NUMERIC,
  scale_name          TEXT,
  triggered_by        TEXT,
  acknowledged        BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_notes  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_study       ON public.clinical_alerts_log(study_id);
CREATE INDEX IF NOT EXISTS idx_alerts_participant  ON public.clinical_alerts_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON public.clinical_alerts_log(acknowledged);

ALTER TABLE public.clinical_alerts_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinical_alerts_log' AND policyname='alerts_researcher_select') THEN
    CREATE POLICY alerts_researcher_select ON public.clinical_alerts_log FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinical_alerts_log' AND policyname='alerts_researcher_update') THEN
    CREATE POLICY alerts_researcher_update ON public.clinical_alerts_log FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinical_alerts_log' AND policyname='alerts_admin_all') THEN
    CREATE POLICY alerts_admin_all ON public.clinical_alerts_log FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 10. IAT INSTRUMENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iat_instruments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id           UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  researcher_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  iat_type           TEXT NOT NULL DEFAULT 'death_suicide',
  category_a         TEXT,
  category_b         TEXT,
  attribute_positive TEXT,
  attribute_negative TEXT,
  debrief_text       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_iat_instruments_study    ON public.iat_instruments(study_id);
CREATE INDEX IF NOT EXISTS idx_iat_instruments_iat_type ON public.iat_instruments(iat_type);

ALTER TABLE public.iat_instruments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_instruments' AND policyname='iat_instruments_researcher') THEN
    CREATE POLICY iat_instruments_researcher ON public.iat_instruments FOR ALL
      USING (researcher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_instruments' AND policyname='iat_instruments_participant_select') THEN
    CREATE POLICY iat_instruments_participant_select ON public.iat_instruments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.study_enrollments se WHERE se.study_id = iat_instruments.study_id AND se.participant_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_instruments' AND policyname='iat_instruments_admin_all') THEN
    CREATE POLICY iat_instruments_admin_all ON public.iat_instruments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 11. IAT TRIAL LOG ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iat_trial_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iat_id               UUID NOT NULL REFERENCES public.iat_instruments(id) ON DELETE CASCADE,
  participant_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id           TEXT NOT NULL,
  block_number         INTEGER NOT NULL,
  block_label          TEXT NOT NULL,
  trial_number         INTEGER NOT NULL,
  stimulus_text        TEXT,
  stimulus_category    TEXT,
  correct_key          TEXT,
  pressed_key          TEXT,
  response_time_ms     INTEGER,
  is_correct           BOOLEAN,
  is_too_fast          BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_from_scoring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iat_trial_log_iat         ON public.iat_trial_log(iat_id);
CREATE INDEX IF NOT EXISTS idx_iat_trial_log_participant ON public.iat_trial_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_iat_trial_log_session     ON public.iat_trial_log(session_id);

ALTER TABLE public.iat_trial_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_trial_log' AND policyname='iat_trial_participant_own') THEN
    CREATE POLICY iat_trial_participant_own ON public.iat_trial_log FOR ALL
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_trial_log' AND policyname='iat_trial_researcher_select') THEN
    CREATE POLICY iat_trial_researcher_select ON public.iat_trial_log FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.iat_instruments ii WHERE ii.id = iat_id AND ii.researcher_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_trial_log' AND policyname='iat_trial_admin_all') THEN
    CREATE POLICY iat_trial_admin_all ON public.iat_trial_log FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 12. IAT SESSION RESULTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iat_session_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iat_id         UUID NOT NULL REFERENCES public.iat_instruments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id     TEXT NOT NULL,
  d_score        NUMERIC(6,4),
  assigned_order TEXT CHECK (assigned_order IN ('A', 'B')),
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (iat_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_iat_results_participant ON public.iat_session_results(participant_id);
CREATE INDEX IF NOT EXISTS idx_iat_results_iat         ON public.iat_session_results(iat_id);

ALTER TABLE public.iat_session_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_session_results' AND policyname='iat_results_participant_own') THEN
    CREATE POLICY iat_results_participant_own ON public.iat_session_results FOR ALL
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_session_results' AND policyname='iat_results_researcher_select') THEN
    CREATE POLICY iat_results_researcher_select ON public.iat_session_results FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.iat_instruments ii WHERE ii.id = iat_id AND ii.researcher_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iat_session_results' AND policyname='iat_results_admin_all') THEN
    CREATE POLICY iat_results_admin_all ON public.iat_session_results FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 13. SOCIOGRAM INSTRUMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sociogram_instruments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id                UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  instructions            TEXT,
  prompt                  TEXT,
  min_nominations         INTEGER NOT NULL DEFAULT 1,
  max_nominations         INTEGER NOT NULL DEFAULT 5,
  allow_self_nomination   BOOLEAN NOT NULL DEFAULT FALSE,
  relationship_scale_min  INTEGER,
  relationship_scale_max  INTEGER,
  scale_label_low         TEXT,
  scale_label_high        TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sociogram_instruments_study ON public.sociogram_instruments(study_id);

ALTER TABLE public.sociogram_instruments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_instruments' AND policyname='sociogram_inst_researcher') THEN
    CREATE POLICY sociogram_inst_researcher ON public.sociogram_instruments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.created_by = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_instruments' AND policyname='sociogram_inst_participant_select') THEN
    CREATE POLICY sociogram_inst_participant_select ON public.sociogram_instruments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.study_enrollments se WHERE se.study_id = sociogram_instruments.study_id AND se.participant_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_instruments' AND policyname='sociogram_inst_admin_all') THEN
    CREATE POLICY sociogram_inst_admin_all ON public.sociogram_instruments FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 14. SOCIOGRAM RELATIONSHIP TYPES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sociogram_relationship_types (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociogram_id         UUID NOT NULL REFERENCES public.sociogram_instruments(id) ON DELETE CASCADE,
  label                TEXT NOT NULL,
  description          TEXT,
  color_hex            TEXT NOT NULL DEFAULT '#888888',
  is_negative_dimension BOOLEAN NOT NULL DEFAULT FALSE,
  display_order        INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_srt_sociogram ON public.sociogram_relationship_types(sociogram_id);

ALTER TABLE public.sociogram_relationship_types ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_relationship_types' AND policyname='srt_researcher_select') THEN
    CREATE POLICY srt_researcher_select ON public.sociogram_relationship_types FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.sociogram_instruments si
        JOIN public.studies s ON s.id = si.study_id
        WHERE si.id = sociogram_id AND s.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_relationship_types' AND policyname='srt_participant_select') THEN
    CREATE POLICY srt_participant_select ON public.sociogram_relationship_types FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.sociogram_instruments si
        JOIN public.study_enrollments se ON se.study_id = si.study_id
        WHERE si.id = sociogram_id AND se.participant_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_relationship_types' AND policyname='srt_admin_all') THEN
    CREATE POLICY srt_admin_all ON public.sociogram_relationship_types FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 15. SOCIOGRAM PARTICIPANTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sociogram_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociogram_id    UUID NOT NULL REFERENCES public.sociogram_instruments(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name    TEXT,
  anonymised_label TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  has_submitted   BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at    TIMESTAMPTZ,
  UNIQUE (sociogram_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_sociogram_participants_sociogram   ON public.sociogram_participants(sociogram_id);
CREATE INDEX IF NOT EXISTS idx_sociogram_participants_participant ON public.sociogram_participants(participant_id);

ALTER TABLE public.sociogram_participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_participants' AND policyname='sp_participant_own') THEN
    CREATE POLICY sp_participant_own ON public.sociogram_participants FOR ALL
      USING (participant_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_participants' AND policyname='sp_researcher_select') THEN
    CREATE POLICY sp_researcher_select ON public.sociogram_participants FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.sociogram_instruments si
        JOIN public.studies s ON s.id = si.study_id
        WHERE si.id = sociogram_id AND s.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_participants' AND policyname='sp_admin_all') THEN
    CREATE POLICY sp_admin_all ON public.sociogram_participants FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 16. SOCIOGRAM NOMINATIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sociogram_nominations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociogram_id         UUID NOT NULL REFERENCES public.sociogram_instruments(id) ON DELETE CASCADE,
  nominator_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nominee_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship_type_id UUID REFERENCES public.sociogram_relationship_types(id) ON DELETE SET NULL,
  score                NUMERIC,
  is_negative_tie      BOOLEAN NOT NULL DEFAULT FALSE,
  is_valid             BOOLEAN NOT NULL DEFAULT TRUE,
  nomination_round     INTEGER NOT NULL DEFAULT 1,
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nominations_sociogram  ON public.sociogram_nominations(sociogram_id);
CREATE INDEX IF NOT EXISTS idx_nominations_nominator  ON public.sociogram_nominations(nominator_id);

ALTER TABLE public.sociogram_nominations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_nominations' AND policyname='nominations_nominator_own') THEN
    CREATE POLICY nominations_nominator_own ON public.sociogram_nominations FOR ALL
      USING (nominator_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_nominations' AND policyname='nominations_researcher_select') THEN
    CREATE POLICY nominations_researcher_select ON public.sociogram_nominations FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.sociogram_instruments si
        JOIN public.studies s ON s.id = si.study_id
        WHERE si.id = sociogram_id AND s.created_by = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sociogram_nominations' AND policyname='nominations_admin_all') THEN
    CREATE POLICY nominations_admin_all ON public.sociogram_nominations FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 17. ACTIVITY LOGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user       ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_logs' AND policyname='activity_logs_own') THEN
    CREATE POLICY activity_logs_own ON public.activity_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_logs' AND policyname='activity_logs_insert') THEN
    CREATE POLICY activity_logs_insert ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_logs' AND policyname='activity_logs_admin_all') THEN
    CREATE POLICY activity_logs_admin_all ON public.activity_logs FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 18. SUPERVISOR–RESEARCHER RELATIONSHIPS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supervisor_researcher_relationships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  researcher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supervisor_id, researcher_id)
);
CREATE INDEX IF NOT EXISTS idx_srr_supervisor ON public.supervisor_researcher_relationships(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_srr_researcher ON public.supervisor_researcher_relationships(researcher_id);

ALTER TABLE public.supervisor_researcher_relationships ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supervisor_researcher_relationships' AND policyname='srr_supervisor_own') THEN
    CREATE POLICY srr_supervisor_own ON public.supervisor_researcher_relationships FOR ALL
      USING (supervisor_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supervisor_researcher_relationships' AND policyname='srr_researcher_select') THEN
    CREATE POLICY srr_researcher_select ON public.supervisor_researcher_relationships FOR SELECT
      USING (researcher_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supervisor_researcher_relationships' AND policyname='srr_admin_all') THEN
    CREATE POLICY srr_admin_all ON public.supervisor_researcher_relationships FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;


-- ─── 19. COHORTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohorts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('draft', 'active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cohorts' AND policyname='cohorts_admin_all') THEN
    CREATE POLICY cohorts_admin_all ON public.cohorts FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cohorts' AND policyname='cohorts_researcher_view') THEN
    CREATE POLICY cohorts_researcher_view ON public.cohorts FOR SELECT
      USING (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.cohort_researcher_access cra
          WHERE cra.cohort_id = cohorts.id AND cra.researcher_id = auth.uid()
        )
      );
  END IF;
END $$;


-- ─── 20. COHORT MEMBERS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id             UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  participant_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  baseline_completed_at TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'withdrawn')),
  PRIMARY KEY (cohort_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_cohort_members_participant ON public.cohort_members(participant_id);

ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cohort_members' AND policyname='cohort_members_admin_all') THEN
    CREATE POLICY cohort_members_admin_all ON public.cohort_members FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cohort_members' AND policyname='cohort_members_researcher_select') THEN
    CREATE POLICY cohort_members_researcher_select ON public.cohort_members FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id
        AND (c.created_by = auth.uid() OR EXISTS (
          SELECT 1 FROM public.cohort_researcher_access cra WHERE cra.cohort_id = c.id AND cra.researcher_id = auth.uid()
        ))
      ));
  END IF;
END $$;


-- ─── 21. COHORT RESEARCHER ACCESS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohort_researcher_access (
  cohort_id     UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  researcher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level  TEXT NOT NULL DEFAULT 'view'
                CHECK (access_level IN ('view', 'contribute')),
  granted_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, researcher_id)
);

ALTER TABLE public.cohort_researcher_access ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cohort_researcher_access' AND policyname='cra_admin_all') THEN
    CREATE POLICY cra_admin_all ON public.cohort_researcher_access FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cohort_researcher_access' AND policyname='cra_researcher_select') THEN
    CREATE POLICY cra_researcher_select ON public.cohort_researcher_access FOR SELECT
      USING (researcher_id = auth.uid());
  END IF;
END $$;


-- ─── 22. PLATFORM REQUESTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type  TEXT NOT NULL
                CHECK (request_type IN ('cohort_access', 'cohort_creation', 'study_approval')),
  entity_type   TEXT,
  entity_id     UUID,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_requests_status    ON public.platform_requests(status);
CREATE INDEX IF NOT EXISTS idx_platform_requests_requester ON public.platform_requests(requester_id);

ALTER TABLE public.platform_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_requests' AND policyname='requests_admin_all') THEN
    CREATE POLICY requests_admin_all ON public.platform_requests FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_requests' AND policyname='requests_own') THEN
    CREATE POLICY requests_own ON public.platform_requests FOR ALL
      USING (requester_id = auth.uid());
  END IF;
END $$;


-- ─── 23. FK: studies → cohorts (added after cohorts table exists) ─────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'studies' AND column_name = 'cohort_id'
  ) THEN
    ALTER TABLE public.studies ADD COLUMN cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;
  ELSE
    -- Column exists but FK might not; safe to ignore if it already has the constraint
    BEGIN
      ALTER TABLE public.studies ADD CONSTRAINT studies_cohort_id_fkey
        FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_studies_cohort ON public.studies(cohort_id);
