-- Stub of the Supabase auth schema/roles, so the RLS isolation test can run on
-- a plain Postgres. On Supabase these already exist — skip this file there.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);

-- Mirror Supabase's helpers: resolve the simulated JWT from a session GUC.
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon');
$$;
