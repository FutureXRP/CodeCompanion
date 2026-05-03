-- CodeCompanion — Practice Pulse migration
-- Add after running 001_initial_schema.sql

create table practice_pulse_issues (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,

  -- Issue classification
  issue_type text not null check (issue_type in (
    'hold_bucket', 'eligibility_failure', 'missing_auth',
    'demographic_mismatch', 'aged_ar_30', 'aged_ar_60', 'aged_ar_90',
    'duplicate_billing', 'credentialing_gap', 'denial_pattern', 'denial_actionable'
  )),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),

  -- Patient/claim reference (opaque IDs only — no PHI)
  athena_patient_id text,
  athena_claim_id text,
  athena_encounter_id text,

  -- Financial impact
  dollar_at_risk numeric(10,2) default 0,
  days_in_queue int default 0,
  deadline_date date,

  -- Denial details
  denial_code text,
  denial_plain_english text,   -- Claude's translation of the denial code
  recommended_action text,     -- Claude's specific fix instruction
  payer_name text,

  -- Status tracking
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  assigned_to text,
  notes text,

  -- Meta
  identified_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_pulse_practice on practice_pulse_issues(practice_id, status);
create index idx_pulse_severity on practice_pulse_issues(practice_id, severity, status);
create index idx_pulse_type on practice_pulse_issues(practice_id, issue_type);

alter table practice_pulse_issues enable row level security;

create policy "own practice only" on practice_pulse_issues
  for all using (practice_id = get_user_practice_id());
