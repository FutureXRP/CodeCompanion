-- 007_ledger.sql — the patient ledger (Rung 1, full RCM).
--
-- Append-only financial entries: charges (837), payments + adjustments (835),
-- and patient payments. Balances are derived by summing the signed deltas, never
-- stored — the ledger is the auditable source of truth for what the payer and the
-- patient still owe. Tenant-isolated, RLS-locked. PHI minimization: no patient
-- name is stored here; the account_key (member id) groups a patient's entries and
-- the claim FK reaches identity only through the RLS-locked claims table.

create table if not exists ledger_entries (
  id                    uuid primary key default uuid_generate_v4(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  claim_id              uuid references claims(id) on delete set null,
  claim_line_id         uuid references claim_lines(id) on delete set null,
  account_key           text not null,
  type                  text not null check (type in (
                          'charge','insurance_payment','contractual_adjustment',
                          'payer_adjustment','patient_responsibility','patient_payment','patient_writeoff')),
  insurance_delta_cents bigint not null default 0,
  patient_delta_cents   bigint not null default 0,
  carc_code             text,
  memo                  text,
  source                text check (source in ('837','835','manual')),
  posted_at             timestamptz not null default now()
);
create index if not exists ledger_entries_tenant_idx on ledger_entries(tenant_id);
create index if not exists ledger_entries_account_idx on ledger_entries(tenant_id, account_key);
create index if not exists ledger_entries_claim_idx on ledger_entries(claim_id);
alter table ledger_entries enable row level security;
drop policy if exists ledger_entries_tenant on ledger_entries;
create policy ledger_entries_tenant on ledger_entries
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
