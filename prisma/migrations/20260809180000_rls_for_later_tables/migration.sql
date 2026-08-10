-- Re-apply deny-by-default row-level security to tables added since the lockdown.
--
-- WHY THIS EXISTS
--
-- `20260720005455_lock_down_public_api_roles` set up two independent defences
-- against Supabase's public API roles: REVOKE all privileges, and ENABLE ROW
-- LEVEL SECURITY with no policies. Its comment says the tables were enumerated
-- dynamically "so that a table added in a later migration cannot be forgotten
-- here" — but a DO block only sees the tables that exist when it runs. It
-- protected every table present that day and nothing created afterwards.
--
-- The REVOKE half does carry forward, because it also set ALTER DEFAULT
-- PRIVILEGES. The RLS half does not: Postgres has no equivalent default. So
-- `push_subscriptions`, added in Phase 8, came into being with privileges
-- correctly revoked and RLS off — two doors were meant to be shut and only one
-- was. Found by `scripts/check-rls.ts` during the Phase 9 review.
--
-- Nothing was reachable in practice; this restores the second defence rather
-- than fixing an active exposure. That distinction is the point of having two.
--
-- Re-running this is harmless: ENABLE ROW LEVEL SECURITY is idempotent, and the
-- application connects as the table owner, which bypasses RLS. We still do NOT
-- use FORCE ROW LEVEL SECURITY, which would constrain the owner and break the
-- app's own queries.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      target.relname
    );
  END LOOP;
END
$$;
