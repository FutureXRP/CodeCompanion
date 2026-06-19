-- 008_corpus.sql — the de-identified behavioral corpus (Rung 2 foundation).
--
-- SACRED BOUNDARY (DATA-MODEL.md / COMPLIANCE.md): this table stores ONLY
-- de-identified aggregate payer behavior. It is structurally incapable of holding
-- a patient or tenant:
--   * NO tenant_id column, and NO foreign key to any tenant-scoped table. The only
--     FK is payer_id -> payers, which is shared reference data (not PHI).
--   * A CHECK enforces small-cell suppression at the database level (sample_n >= 11),
--     so a single patient's behavior can never be published even by a bug upstream.
--   * RLS is enabled with NO tenant policy (there is no tenant column). Authenticated
--     users get nothing; only the service / prediction role (which bypasses RLS)
--     reads or writes it, through the one-way de-id transform in lib/corpus/.

create table if not exists payer_behavior_corpus (
  id                uuid primary key default uuid_generate_v4(),
  payer_id          uuid references payers(id),
  region            text not null,              -- coarse geography (e.g. state); never an address
  specialty         text not null,
  cpt_hcpcs         text not null,
  modifier          text not null default '',
  contract_class    text not null,              -- bucketed (medicare/medicaid/commercial/other)
  allowed_stat      jsonb not null,             -- distribution stats, not raw values
  paid_stat         jsonb not null,
  days_to_pay_stat  jsonb,
  denial_rate       numeric not null default 0,
  top_carc_codes    text[] not null default '{}',  -- standardized HIPAA codes, not PHI
  sample_n          int not null,
  updated_at        timestamptz not null default now(),
  constraint corpus_min_sample check (sample_n >= 11)  -- small-cell suppression, enforced in the schema
);

-- One row per behavior cell (enables upsert as more observations arrive).
create unique index if not exists payer_behavior_corpus_cell
  on payer_behavior_corpus (payer_id, region, specialty, cpt_hcpcs, modifier, contract_class);

-- RLS on, but NO tenant policy: the table has no tenant column. Only the service
-- role (RLS-exempt) touches it; authenticated users have no policy and so no access.
alter table payer_behavior_corpus enable row level security;
