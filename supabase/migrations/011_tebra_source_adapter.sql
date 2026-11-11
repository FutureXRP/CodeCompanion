-- 011_tebra_source_adapter.sql — allow 'tebra' as a claim source adapter.
--
-- 005 declared the check inline (Postgres names it claims_source_adapter_check).
-- Re-runnable: drop whichever check mentions source_adapter, then add the new one.
-- Apply to a live database on its own:  npm run db:migrate -- --only=011

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.claims'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%source_adapter%'
  loop
    execute format('alter table public.claims drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.claims
  add constraint claims_source_adapter_check
  check (source_adapter in ('athena', 'edi', 'fhir', 'tebra'));
