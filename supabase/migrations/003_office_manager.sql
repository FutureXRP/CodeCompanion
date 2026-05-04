-- CodeCompanion — Office Manager expansion
-- Run after 002_practice_pulse.sql

create table office_manager_items (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,

  category text not null check (category in (
    'unreviewed_lab', 'patient_balance', 'recall_overdue',
    'portal_message', 'unconfirmed_appointment'
  )),
  severity text not null default 'medium'
    check (severity in ('high', 'medium', 'low')),

  -- Patient reference (opaque ID only)
  athena_patient_id text,
  athena_appointment_id text,

  -- Item details
  title text not null,
  detail text,
  dollar_amount numeric(10,2) default 0,
  days_pending int default 0,
  due_date date,

  -- Status
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'dismissed')),

  identified_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_office_mgr_practice on office_manager_items(practice_id, status);
create index idx_office_mgr_category on office_manager_items(practice_id, category);

alter table office_manager_items enable row level security;
create policy "own practice only" on office_manager_items
  for all using (practice_id = get_user_practice_id());
