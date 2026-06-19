-- 009_operational.sql — persistence for the operational modules + the audit log.
--
-- Adds the tables the office-manager suite needs to be stateful in production:
-- eligibility checks, transaction enrollments, patient payment transactions, the
-- follow-up task queue, and an append-only audit log of PHI access. Every table
-- is tenant-scoped with RLS in the same migration that creates it (CLAUDE.md: a
-- table without RLS is incomplete). Same pattern as 005: tenant_id = current_tenant_id().

create extension if not exists "uuid-ossp";

-- ── Eligibility checks (270/271 results) [PHI] ──────────────────────────────
create table if not exists eligibility_checks (
  id                            uuid primary key default uuid_generate_v4(),
  tenant_id                     uuid not null references tenants(id) on delete cascade,
  payer_id                      uuid references payers(id),
  account_key                   text not null,           -- member id (PHI, RLS-locked)
  status                        text not null check (status in ('active','inactive','unknown')),
  copay_cents                   bigint,
  coinsurance_pct               numeric,                 -- 0..1
  deductible_cents              bigint,
  deductible_remaining_cents    bigint,
  out_of_pocket_cents           bigint,
  out_of_pocket_remaining_cents bigint,
  plan_name                     text,
  source                        text check (source in ('mock','stedi')),
  checked_at                    timestamptz not null default now()
);
create index if not exists eligibility_checks_tenant_idx on eligibility_checks(tenant_id);
create index if not exists eligibility_checks_account_idx on eligibility_checks(tenant_id, account_key);
alter table eligibility_checks enable row level security;
create policy eligibility_checks_tenant on eligibility_checks
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Transaction enrollments (provider × payer × transaction) [PHI/tenant] ───
create table if not exists transaction_enrollments (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  provider_npi      text not null,
  payer_external_id text not null,
  clearinghouse     text not null check (clearinghouse in ('mock','stedi','claimmd','availity','office_ally')),
  transaction       text not null check (transaction in ('claim','era','eligibility')),
  state             text not null default 'not_started'
                      check (state in ('not_required','not_started','pending','approved','rejected')),
  effective_date    date,
  note              text,
  updated_at        timestamptz not null default now(),
  unique (tenant_id, provider_npi, payer_external_id, clearinghouse, transaction)
);
create index if not exists transaction_enrollments_tenant_idx on transaction_enrollments(tenant_id);
alter table transaction_enrollments enable row level security;
create policy transaction_enrollments_tenant on transaction_enrollments
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Patient payment transactions (provider-side record) [PHI] ───────────────
-- The accounting lives in ledger_entries (type patient_payment); THIS is the
-- payment-processor record (method, provider, external id) for reconciliation.
create table if not exists payment_transactions (
  id                      uuid primary key default uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  claim_id                uuid references claims(id) on delete set null,
  account_key             text not null,
  amount_cents            bigint not null check (amount_cents > 0),
  method                  text not null check (method in ('card','cash','check','ach')),
  provider                text not null check (provider in ('mock','stripe')),
  external_transaction_id text,
  status                  text not null default 'succeeded' check (status in ('succeeded','failed','pending')),
  created_at              timestamptz not null default now()
);
create index if not exists payment_transactions_tenant_idx on payment_transactions(tenant_id);
create index if not exists payment_transactions_account_idx on payment_transactions(tenant_id, account_key);
alter table payment_transactions enable row level security;
create policy payment_transactions_tenant on payment_transactions
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Follow-up task queue [PHI] ──────────────────────────────────────────────
create table if not exists tasks (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  source        text not null check (source in ('denial','follow_up','balance')),
  title         text not null,
  detail        text,
  dollars_cents bigint not null default 0,
  assignee      text,
  status        text not null default 'open' check (status in ('open','in_progress','done')),
  priority      text not null default 'medium' check (priority in ('high','medium','low')),
  due_date      date,
  claim_id      uuid references claims(id) on delete set null,
  finding_id    uuid references findings(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_tenant_idx on tasks(tenant_id);
create index if not exists tasks_status_idx on tasks(tenant_id, status);
create index if not exists tasks_assignee_idx on tasks(tenant_id, assignee);
alter table tasks enable row level security;
create policy tasks_tenant on tasks
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Audit log [PHI] — append-only record of PHI access (COMPLIANCE.md) ───────
create table if not exists audit_log (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid,                       -- auth.users id of the actor; null for service jobs
  action       text not null,              -- read | write | export | payment | submit | ...
  resource     text not null,              -- table / domain touched
  resource_id  text,
  detail       jsonb,
  at           timestamptz not null default now()
);
create index if not exists audit_log_tenant_idx on audit_log(tenant_id, at desc);
create index if not exists audit_log_resource_idx on audit_log(tenant_id, resource);
alter table audit_log enable row level security;
-- Append + read within the tenant; never update or delete (immutability below).
create policy audit_log_insert on audit_log
  for insert with check (tenant_id = current_tenant_id());
create policy audit_log_select on audit_log
  for select using (tenant_id = current_tenant_id());
revoke update, delete on audit_log from authenticated;

-- Hard immutability: reject UPDATE/DELETE for everyone, including the table owner
-- and the service role. An audit trail you can rewrite is not an audit trail.
create or replace function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op;
end;
$$;
drop trigger if exists audit_log_no_mutate on audit_log;
create trigger audit_log_no_mutate
  before update or delete on audit_log
  for each row execute function audit_log_immutable();
