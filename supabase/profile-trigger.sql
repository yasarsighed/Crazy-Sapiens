-- ═══════════════════════════════════════════════════════════════════════════
-- Profile trigger migration
-- Run once in the Supabase SQL editor (safe to re-run — uses CREATE OR REPLACE).
--
-- What it does
-- ────────────
-- Creates (or replaces) a trigger function that fires AFTER INSERT on
-- auth.users and writes the new user's metadata into public.profiles.
-- Fields covered:
--   • id, email, full_name, role, researcher_color (all users)
--   • date_of_birth, gender, education_level, occupation (participants)
-- An ON CONFLICT DO UPDATE handles the edge-case where a profile row already
-- exists (e.g. admin-created users that get the profile upserted server-side).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    researcher_color,
    date_of_birth,
    gender,
    education_level,
    occupation
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'participant'),
    NULLIF(NEW.raw_user_meta_data ->> 'researcher_color', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::DATE,
    NULLIF(NEW.raw_user_meta_data ->> 'gender', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'education_level', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'occupation', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    full_name       = COALESCE(EXCLUDED.full_name,       profiles.full_name),
    role            = COALESCE(EXCLUDED.role,            profiles.role),
    researcher_color= COALESCE(EXCLUDED.researcher_color,profiles.researcher_color),
    date_of_birth   = COALESCE(EXCLUDED.date_of_birth,   profiles.date_of_birth),
    gender          = COALESCE(EXCLUDED.gender,          profiles.gender),
    education_level = COALESCE(EXCLUDED.education_level, profiles.education_level),
    occupation      = COALESCE(EXCLUDED.occupation,      profiles.occupation),
    updated_at      = NOW();
  RETURN NEW;
END;
$$;

-- Re-create the trigger (DROP + CREATE is idempotent here)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
