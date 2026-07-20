-- Lock this database down against Supabase's public API roles.
--
-- WHY THIS EXISTS
--
-- Supabase exposes the `public` schema over PostgREST at
-- https://<project>.supabase.co/rest/v1/, authenticated with an `anon` key that
-- is *designed to be public* — it ships inside browser bundles.
--
-- Tables created through the Supabase UI get row-level security enabled
-- automatically. Tables created by a migration tool, as all of ours were via
-- Prisma, do not — and Supabase's default privileges still grant `anon` and
-- `authenticated` full access to them.
--
-- The result before this migration: all 19 tables were readable and writable
-- over the REST API by anyone holding the project's public key, completely
-- bypassing every authorization control in the application. That included
-- `children`, `guardianships`, `users` (password hashes) and `sessions`
-- (session token hashes).
--
-- Two independent defences, because either alone is one mistake away from
-- failing:
--
--   1. REVOKE — the API roles hold no privileges at all, so PostgREST cannot
--      read the tables even if RLS were later switched off.
--   2. ENABLE ROW LEVEL SECURITY with no policies — deny by default, so a
--      future GRANT (Supabase's default privileges can reapply on new tables)
--      still yields nothing.
--
-- The application is unaffected: it connects as the table owner over a direct
-- connection string, and the owner bypasses RLS. We deliberately do NOT use
-- FORCE ROW LEVEL SECURITY, which would also constrain the owner and break the
-- app's own queries.
--
-- Authorization for this application lives in src/lib/data/, not in RLS
-- policies. RLS here is a blast door on an entrance we never use, not the
-- access-control model.
--
-- Everything below is guarded so this migration also applies cleanly to a plain
-- Postgres database — Prisma's shadow database, a CI service container, a
-- self-hosted deployment — where the Supabase roles simply do not exist.

-- --------------------------------------------------------------------------
-- 1. Remove all privileges from the public API roles, where they exist.
-- --------------------------------------------------------------------------

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', api_role);

      -- Without this, the next migration's new tables would be granted to the
      -- API roles automatically and silently re-expose themselves.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END
$$;

-- --------------------------------------------------------------------------
-- 2. Deny by default at the row level, on every table in the schema.
--
-- Enumerated dynamically rather than listed by name so that a table added in a
-- later migration cannot be forgotten here.
-- --------------------------------------------------------------------------

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      target.tablename
    );
  END LOOP;
END
$$;
