-- CodeCompanion — consolidated Supabase schema. Idempotent, safe to re-run.
-- Equivalent to migrations 005 + 006. Paste into the Supabase SQL editor.
--
-- Multi-tenant RLS on Supabase Auth: current_tenant_id() resolves the caller's
-- tenant from tenant_users via auth.uid(). Every tenant table enforces RLS.

create extension if not exists "uuid-ossp";

-- ── Tenancy + auth binding ──────────────────────────────────────────────────
create table if not exists tenants (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists tenant_users (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','admin','member')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_users_user_idx on tenant_users(user_id);

create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from tenant_users where user_id = auth.uid() limit 1
$$;
revoke all on function current_tenant_id() from public;
grant execute on function current_tenant_id() to authenticated, service_role;

alter table tenants enable row level security;
drop policy if exists tenants_self_select on tenants;
create policy tenants_self_select on tenants for select using (id = current_tenant_id());

alter table tenant_users enable row level security;
drop policy if exists tenant_users_self_select on tenant_users;
create policy tenant_users_self_select on tenant_users for select using (user_id = auth.uid());

-- ── Reference (shared, no PHI) ───────────────────────────────────────────────
create table if not exists payers (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,
  payer_id_external  text
);
create index if not exists payers_external_idx on payers(payer_id_external);
alter table payers enable row level security;
drop policy if exists payers_read on payers;
create policy payers_read on payers for select using (auth.role() = 'authenticated');

-- ── Tenant-scoped PHI (the 837 side) ─────────────────────────────────────────
create table if not exists providers (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  npi         text,
  name        text,
  specialty   text,
  created_at  timestamptz not null default now()
);
create index if not exists providers_tenant_idx on providers(tenant_id);
alter table providers enable row level security;
drop policy if exists providers_tenant on providers;
create policy providers_tenant on providers
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists patients (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  external_ref  text,
  created_at    timestamptz not null default now()
);
create index if not exists patients_tenant_idx on patients(tenant_id);
alter table patients enable row level security;
drop policy if exists patients_tenant on patients;
create policy patients_tenant on patients
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists encounters (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  patient_id        uuid references patients(id) on delete set null,
  provider_id       uuid references providers(id) on delete set null,
  date_of_service   date,
  place_of_service  text
);
create index if not exists encounters_tenant_idx on encounters(tenant_id);
alter table encounters enable row level security;
drop policy if exists encounters_tenant on encounters;
create policy encounters_tenant on encounters
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists claims (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  encounter_id        uuid references encounters(id) on delete set null,
  payer_id            uuid references payers(id),
  control_number      text,
  total_billed_cents  bigint not null default 0,
  submitted_at        timestamptz,
  source_adapter      text check (source_adapter in ('athena','edi','fhir')),
  created_at          timestamptz not null default now()
);
create index if not exists claims_tenant_idx on claims(tenant_id);
create index if not exists claims_control_idx on claims(tenant_id, control_number);
alter table claims enable row level security;
drop policy if exists claims_tenant on claims;
create policy claims_tenant on claims
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists claim_lines (
  id            uuid primary key default uuid_generate_v4(),
  claim_id      uuid not null references claims(id) on delete cascade,
  line_number   int,
  cpt_hcpcs     text,
  modifiers     text[] not null default '{}',
  units         int not null default 1,
  dx_pointers   int[] not null default '{}',
  billed_cents  bigint not null default 0
);
create index if not exists claim_lines_claim_idx on claim_lines(claim_id);
alter table claim_lines enable row level security;
drop policy if exists claim_lines_tenant on claim_lines;
create policy claim_lines_tenant on claim_lines
  using (exists (select 1 from claims c where c.id = claim_lines.claim_id and c.tenant_id = current_tenant_id()))
  with check (exists (select 1 from claims c where c.id = claim_lines.claim_id and c.tenant_id = current_tenant_id()));

-- ── Tenant-scoped PHI (the 835 side) ─────────────────────────────────────────
create table if not exists remittances (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  claim_id       uuid references claims(id) on delete set null,
  payer_id       uuid references payers(id),
  check_eft_ref  text,
  paid_at        date,
  created_at     timestamptz not null default now()
);
create index if not exists remittances_tenant_idx on remittances(tenant_id);
create index if not exists remittances_claim_idx on remittances(claim_id);
alter table remittances enable row level security;
drop policy if exists remittances_tenant on remittances;
create policy remittances_tenant on remittances
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists remittance_lines (
  id                  uuid primary key default uuid_generate_v4(),
  remittance_id       uuid not null references remittances(id) on delete cascade,
  claim_line_id       uuid references claim_lines(id) on delete set null,
  allowed_cents       bigint not null default 0,
  paid_cents          bigint not null default 0,
  patient_resp_cents  bigint not null default 0
);
create index if not exists remittance_lines_remit_idx on remittance_lines(remittance_id);
alter table remittance_lines enable row level security;
drop policy if exists remittance_lines_tenant on remittance_lines;
create policy remittance_lines_tenant on remittance_lines
  using (exists (select 1 from remittances r where r.id = remittance_lines.remittance_id and r.tenant_id = current_tenant_id()))
  with check (exists (select 1 from remittances r where r.id = remittance_lines.remittance_id and r.tenant_id = current_tenant_id()));

create table if not exists adjustments (
  id                  uuid primary key default uuid_generate_v4(),
  remittance_line_id  uuid not null references remittance_lines(id) on delete cascade,
  group_code          text,
  carc_code           text,
  rarc_code           text,
  amount_cents        bigint not null default 0
);
create index if not exists adjustments_line_idx on adjustments(remittance_line_id);
alter table adjustments enable row level security;
drop policy if exists adjustments_tenant on adjustments;
create policy adjustments_tenant on adjustments
  using (exists (select 1 from remittance_lines rl join remittances r on r.id = rl.remittance_id
                 where rl.id = adjustments.remittance_line_id and r.tenant_id = current_tenant_id()))
  with check (exists (select 1 from remittance_lines rl join remittances r on r.id = rl.remittance_id
                 where rl.id = adjustments.remittance_line_id and r.tenant_id = current_tenant_id()));

-- ── Contracts / fee schedule ─────────────────────────────────────────────────
create table if not exists payer_contracts (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  payer_id        uuid references payers(id),
  effective_date  date,
  expiry_date     date
);
create index if not exists payer_contracts_tenant_idx on payer_contracts(tenant_id);
alter table payer_contracts enable row level security;
drop policy if exists payer_contracts_tenant on payer_contracts;
create policy payer_contracts_tenant on payer_contracts
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists fee_schedule_lines (
  id                uuid primary key default uuid_generate_v4(),
  contract_id       uuid not null references payer_contracts(id) on delete cascade,
  cpt_hcpcs         text,
  modifier          text,
  contracted_cents  bigint not null default 0
);
create index if not exists fee_schedule_contract_idx on fee_schedule_lines(contract_id);
alter table fee_schedule_lines enable row level security;
drop policy if exists fee_schedule_tenant on fee_schedule_lines;
create policy fee_schedule_tenant on fee_schedule_lines
  using (exists (select 1 from payer_contracts pc where pc.id = fee_schedule_lines.contract_id and pc.tenant_id = current_tenant_id()))
  with check (exists (select 1 from payer_contracts pc where pc.id = fee_schedule_lines.contract_id and pc.tenant_id = current_tenant_id()));

-- ── Diff output (Rung 0) ──────────────────────────────────────────────────────
create table if not exists findings (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  claim_line_id   uuid references claim_lines(id) on delete set null,
  type            text,
  expected_cents  bigint not null default 0,
  actual_cents    bigint not null default 0,
  delta_cents     bigint not null default 0,
  appealable      boolean not null default false,
  status          text not null default 'open' check (status in ('open','appealing','recovered','terminal')),
  detected_at     timestamptz not null default now()
);
-- finding type incl. 'unadjudicated' (migration 006) — set idempotently
alter table findings drop constraint if exists findings_type_check;
alter table findings add constraint findings_type_check
  check (type in ('underpayment','denial','undercoding','unadjudicated'));
create index if not exists findings_tenant_idx on findings(tenant_id);
create index if not exists findings_claim_line_idx on findings(claim_line_id);
alter table findings enable row level security;
drop policy if exists findings_tenant on findings;
create policy findings_tenant on findings
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
