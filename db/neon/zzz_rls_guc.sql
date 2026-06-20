-- zzz_rls_guc.sql — apply LAST (Neon only).
--
-- Repoints tenant resolution at the per-request GUC, so the RLS policies created
-- in 005/009 (tenant_id = current_tenant_id()) enforce on Neon without a Supabase
-- session. The app sets app.current_tenant for the duration of each request via
-- withTenant() in lib/db/sql.ts.

create or replace function current_tenant_id()
returns uuid
language sql
stable
as $$ select nullif(current_setting('app.current_tenant', true), '')::uuid $$;

-- NOTE (multi-tenant hardening): Postgres exempts a table's OWNER from RLS unless
-- FORCE ROW LEVEL SECURITY is set. For a single practice the explicit
-- `where tenant_id = $1` scoping in the repos is the active guard and the GUC/RLS
-- is defense-in-depth. When you go multi-tenant, connect the app as a NON-owner
-- role and `alter table <t> force row level security;` on every tenant-scoped
-- table so RLS becomes load-bearing. Left off here on purpose.
