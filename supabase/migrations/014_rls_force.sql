-- 014_rls_force.sql — row-level security becomes load-bearing (COMPLIANCE.md).
--
-- Until now the app connected to Neon as the table owner, which Postgres exempts
-- from row-level security, so tenant isolation rested on the repos' explicit
-- `tenant_id` filters alone. This migration:
--   1. adds app_is_service(): true inside withService() (lib/db/sql.ts sets
--      app.role = 'service' for the transaction) — the context for tenant
--      bootstrap, the sync's tenant lookup, and the de-identified corpus;
--   2. adds a <table>_service policy to every RLS-enabled table so that context
--      keeps working once RLS is forced (permissive policies OR together), and
--      lets tenant transactions maintain the shared, PHI-free payer catalog;
--   3. FORCES row level security on every RLS-enabled table — the owner is no
--      longer exempt: a query outside a tenant or service context sees nothing
--      and writes nothing;
--   4. creates the NOLOGIN group role codecompanion_app with the runtime grants.
--      The app's login role is made a member of it (DEPLOY.md §1), so the app
--      never connects as the owner. Migrations keep running as the owner.
-- Idempotent. New tables must repeat the pattern: enable + force RLS, a tenant
-- policy, and a <table>_service policy (the static guard test checks the force).

-- 1. the service context
create or replace function app_is_service() returns boolean
language sql stable
as $$ select coalesce(current_setting('app.role', true), '') = 'service' $$;

-- 2. a service policy on every table that has RLS
do $$
declare t record;
begin
  for t in
    select c.relname as name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists %I on public.%I', t.name || '_service', t.name);
    execute format('create policy %I on public.%I for all using (app_is_service()) with check (app_is_service())', t.name || '_service', t.name);
  end loop;
end $$;

-- The shared payer catalog carries no PHI and is maintained from tenant
-- transactions (ensurePayer during a persisted run): any context may write it.
drop policy if exists payers_write on payers;
create policy payers_write on payers for all using (true) with check (true);

-- 3. force RLS — one explicit line per table, so the static guard test sees each
alter table practices force row level security;
alter table practice_users force row level security;
alter table athena_connections force row level security;
alter table subscriptions force row level security;
alter table sync_jobs force row level security;
alter table coding_suggestions force row level security;
alter table encounter_flags force row level security;
alter table care_gaps force row level security;
alter table audit_risks force row level security;
alter table schedule_risks force row level security;
alter table billing_patterns force row level security;
alter table practice_pulse_issues force row level security;
alter table office_manager_items force row level security;
alter table unpostable_encounters force row level security;
alter table tenants force row level security;
alter table tenant_users force row level security;
alter table payers force row level security;
alter table providers force row level security;
alter table patients force row level security;
alter table encounters force row level security;
alter table claims force row level security;
alter table claim_lines force row level security;
alter table remittances force row level security;
alter table remittance_lines force row level security;
alter table adjustments force row level security;
alter table payer_contracts force row level security;
alter table fee_schedule_lines force row level security;
alter table findings force row level security;
alter table ledger_entries force row level security;
alter table payer_behavior_corpus force row level security;
alter table eligibility_checks force row level security;
alter table transaction_enrollments force row level security;
alter table payment_transactions force row level security;
alter table tasks force row level security;
alter table audit_log force row level security;
alter table feature_flags force row level security;

-- 4. the runtime group role (least privilege: data access, no DDL, no RLS bypass)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'codecompanion_app') then
    begin
      create role codecompanion_app nologin;
    exception when insufficient_privilege then
      raise notice 'codecompanion_app could not be created by this role — create a NOLOGIN role named codecompanion_app from the Neon console, then re-run: npm run db:migrate -- --only=014';
    end;
  end if;
  if exists (select 1 from pg_roles where rolname = 'codecompanion_app') then
    execute 'grant usage on schema public to codecompanion_app';
    execute 'grant usage on schema auth to codecompanion_app';
    execute 'grant select, insert, update, delete on all tables in schema public to codecompanion_app';
    execute 'grant select, insert on all tables in schema auth to codecompanion_app';
    execute 'grant usage, select on all sequences in schema public to codecompanion_app';
    execute 'grant execute on all functions in schema public to codecompanion_app';
    execute 'grant execute on all functions in schema auth to codecompanion_app';
    execute 'alter default privileges in schema public grant select, insert, update, delete on tables to codecompanion_app';
    execute 'alter default privileges in schema public grant usage, select on sequences to codecompanion_app';
    execute 'alter default privileges in schema public grant execute on functions to codecompanion_app';
    -- append-only even without the trigger
    execute 'revoke update, delete on audit_log from codecompanion_app';
  end if;
end $$;
