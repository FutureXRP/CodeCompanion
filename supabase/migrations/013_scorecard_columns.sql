-- 013_scorecard_columns.sql — what the scorecard needs that the run didn't store.
--
-- claims.date_of_service   → by-month trends (the 90-day post-switch scorecard)
-- findings.recoverable_cents → the ranking figure the diff produces (delta is
--                              contracted − paid; recoverable also credits patient
--                              responsibility), so "open recoverable" is exact.
-- Re-runnable. A tracked `npm run db:migrate` applies it once.

alter table public.claims add column if not exists date_of_service date;
create index if not exists claims_dos_idx on public.claims(tenant_id, date_of_service);

alter table public.findings add column if not exists recoverable_cents bigint not null default 0;
