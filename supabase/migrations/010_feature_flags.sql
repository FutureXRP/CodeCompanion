-- 010_feature_flags.sql — per-tenant module on/off state for the Admin panel.
-- Tenant-scoped with RLS in the same migration that creates it (CLAUDE.md).

create extension if not exists "uuid-ossp";

create table if not exists feature_flags (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  module_id   text not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique (tenant_id, module_id)
);
create index if not exists feature_flags_tenant_idx on feature_flags(tenant_id);
alter table feature_flags enable row level security;
drop policy if exists feature_flags_tenant on feature_flags;
create policy feature_flags_tenant on feature_flags
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
