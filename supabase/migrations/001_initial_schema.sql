-- CodeCompanion Initial Schema
create extension if not exists "uuid-ossp";

-- Core tables
create table practices (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  athena_practice_id text,
  subscription_tier text not null default 'starter'
    check (subscription_tier in ('starter','professional','group')),
  created_at timestamptz not null default now()
);

create table practice_users (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  clerk_user_id text not null unique,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now()
);

create table athena_connections (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade unique,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null default 'starter',
  status text not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table sync_jobs (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  records_processed int default 0,
  error text,
  created_at timestamptz not null default now()
);

-- Intelligence tables
create table coding_suggestions (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_encounter_id text not null,
  athena_patient_id text not null,
  encounter_date date not null,
  suggested_em_level text,
  suggested_icd10_codes jsonb default '[]',
  suggested_cpt_codes jsonb default '[]',
  suggested_modifiers jsonb default '[]',
  confidence numeric(3,2) default 0,
  reasoning text,
  status text not null default 'pending'
    check (status in ('pending','approved','edited','rejected')),
  provider_edited_codes jsonb,
  approved_at timestamptz,
  claude_model text,
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now(),
  unique(practice_id, athena_encounter_id)
);

create table encounter_flags (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_encounter_id text not null,
  athena_patient_id text not null,
  encounter_date date not null,
  flag_type text not null
    check (flag_type in ('undercoding','upcoding_risk','wrong_code','modifier_issue','documentation_gap')),
  billed_code text not null,
  suggested_code text,
  revenue_delta numeric(10,2) default 0,
  confidence numeric(3,2) default 0,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table care_gaps (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_patient_id text not null,
  gap_type text not null
    check (gap_type in ('awv','ccm_enrollment','hcc_recapture','quality_measure','overdue_lab','immunization','screening','depression_screening')),
  gap_code text,
  estimated_revenue numeric(10,2) default 0,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  identified_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table audit_risks (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  risk_type text not null
    check (risk_type in ('upcoding_pattern','modifier_overuse','documentation_gap','rac_target','oig_watchlist')),
  severity text not null default 'medium' check (severity in ('high','medium','low')),
  code text,
  rate_actual numeric(5,4),
  rate_benchmark numeric(5,4),
  affected_count int default 0,
  description text,
  identified_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table schedule_risks (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_appointment_id text not null,
  athena_patient_id text not null,
  no_show_probability numeric(3,2) not null,
  appointment_date date not null,
  appointment_time time,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table billing_patterns (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  period_month date not null,
  code text not null,
  claim_count int default 0,
  avg_allowed numeric(10,2),
  peer_benchmark_rate numeric(5,4),
  created_at timestamptz not null default now(),
  unique(practice_id, period_month, code)
);

-- Indexes
create index idx_coding_suggestions_practice on coding_suggestions(practice_id);
create index idx_coding_suggestions_status on coding_suggestions(practice_id, status);
create index idx_encounter_flags_practice on encounter_flags(practice_id, resolved);
create index idx_care_gaps_practice on care_gaps(practice_id, resolved_at);
create index idx_audit_risks_practice on audit_risks(practice_id, resolved);
create index idx_schedule_risks_date on schedule_risks(practice_id, appointment_date);
create index idx_practice_users_clerk on practice_users(clerk_user_id);

-- Row Level Security
alter table practices enable row level security;
alter table practice_users enable row level security;
alter table athena_connections enable row level security;
alter table subscriptions enable row level security;
alter table sync_jobs enable row level security;
alter table coding_suggestions enable row level security;
alter table encounter_flags enable row level security;
alter table care_gaps enable row level security;
alter table audit_risks enable row level security;
alter table schedule_risks enable row level security;
alter table billing_patterns enable row level security;

create or replace function get_user_practice_id()
returns uuid language sql security definer as $$
  select practice_id from practice_users
  where clerk_user_id = current_setting('app.clerk_user_id', true)
  limit 1;
$$;

create policy "own practice only" on practices for all using (id = get_user_practice_id());
create policy "own practice only" on practice_users for all using (practice_id = get_user_practice_id());
create policy "own practice only" on athena_connections for all using (practice_id = get_user_practice_id());
create policy "own practice only" on subscriptions for all using (practice_id = get_user_practice_id());
create policy "own practice only" on sync_jobs for all using (practice_id = get_user_practice_id());
create policy "own practice only" on coding_suggestions for all using (practice_id = get_user_practice_id());
create policy "own practice only" on encounter_flags for all using (practice_id = get_user_practice_id());
create policy "own practice only" on care_gaps for all using (practice_id = get_user_practice_id());
create policy "own practice only" on audit_risks for all using (practice_id = get_user_practice_id());
create policy "own practice only" on schedule_risks for all using (practice_id = get_user_practice_id());
create policy "own practice only" on billing_patterns for all using (practice_id = get_user_practice_id());
