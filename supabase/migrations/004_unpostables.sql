-- PracticeCompanion — Unpostables migration
-- Run after 003_office_manager.sql

create table unpostable_encounters (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,

  -- Encounter reference
  athena_encounter_id text not null,
  athena_patient_id text not null,
  encounter_date date not null,
  encounter_type text,

  -- Block details
  encounter_status text not null check (encounter_status in ('OPEN', 'REVIEW', 'HOLD')),
  block_reason text not null check (block_reason in (
    'no_diagnosis', 'note_unsigned', 'insurance_unverified',
    'billing_hold', 'missing_provider', 'orders_pending', 'other'
  )),
  days_outstanding int not null default 0,
  dollar_at_risk numeric(10,2) default 0,

  -- AI translation
  plain_english text,
  recommended_action text,
  filing_deadline date,

  -- Payer info
  payer_name text,

  -- Status
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'dismissed')),

  identified_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_unpostables_practice on unpostable_encounters(practice_id, status);
create index idx_unpostables_days on unpostable_encounters(practice_id, days_outstanding desc);

alter table unpostable_encounters enable row level security;
create policy "own practice only" on unpostable_encounters
  for all using (practice_id = get_user_practice_id());
