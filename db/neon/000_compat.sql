-- 000_compat.sql — Neon compatibility shim (apply FIRST; Neon only).
--
-- The supabase/migrations/*.sql were authored for Supabase. This shim lets them
-- apply unchanged to a plain Postgres (Neon) by providing the Supabase-isms they
-- reference: the anon / authenticated / service_role roles, and a minimal `auth`
-- schema with auth.users + auth.uid(). Supabase's own tooling already provides
-- these, so this file is NEVER applied to the Supabase auth project — only to Neon
-- via `npm run db:migrate`.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;

-- Supabase keeps users in auth.users; tenant_users FKs to it (005). Minimal stand-in.
create table if not exists auth.users (
  id     uuid primary key,
  email  text
);

-- On Supabase, auth.uid() returns the JWT subject. On Neon we feed the app user id
-- via a GUC (app.current_user_id). Tenant resolution itself is repointed at the
-- app.current_tenant GUC in zzz_rls_guc.sql, applied last.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.current_user_id', true), '')::uuid $$;
