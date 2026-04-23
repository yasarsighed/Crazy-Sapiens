-- Fix: wrap profile creation trigger in EXCEPTION handler so a constraint
-- violation or missing column never blocks auth.admin.createUser.
-- Also adds the socio-demographic columns if not yet present.
--
-- Paste the entire file in Supabase Dashboard → SQL Editor and run.

-- 1. Ensure socio-demographic columns exist (no-op if already added)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth   DATE,
  ADD COLUMN IF NOT EXISTS gender          TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS occupation      TEXT;

-- 2. Replace the trigger function with an exception-safe version.
--    The EXCEPTION block means user creation always succeeds even if the
--    profile INSERT fails — the API route's upsert picks up the slack.
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role, researcher_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'participant'),
    COALESCE(NEW.raw_user_meta_data->>'researcher_color', '#2D6A4F')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block user creation because of a profile insert failure.
  -- The API route (app/api/participants/create/route.ts) runs a follow-up
  -- upsert that will create the profile row if this trigger skipped it.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-attach the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();
