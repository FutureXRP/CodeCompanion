-- Default grants Supabase applies (needed for the non-owner role to reach tables).
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

-- Seed as the bootstrap superuser (RLS is bypassed for the table owner).
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant One'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant Two');
insert into auth.users(id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'u1@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'u2@example.com');
insert into tenant_users(tenant_id, user_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into payers(id, name, payer_id_external) values
  ('33333333-3333-3333-3333-333333333333', 'Medicare', '00123');
insert into claims(id, tenant_id, payer_id, control_number, total_billed_cents, source_adapter) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'C1', 15000, 'edi'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'C2', 20000, 'edi');
insert into claim_lines(claim_id, line_number, cpt_hcpcs, billed_cents) values
  ('c1111111-1111-1111-1111-111111111111', 1, '99214', 15000),
  ('c2222222-2222-2222-2222-222222222222', 1, '99215', 20000);

-- Operational modules (009): one row per tenant, to prove isolation.
insert into eligibility_checks(tenant_id, account_key, status, source) values
  ('11111111-1111-1111-1111-111111111111', 'MEMBER-A', 'active', 'mock'),
  ('22222222-2222-2222-2222-222222222222', 'MEMBER-B', 'inactive', 'mock');
insert into transaction_enrollments(tenant_id, provider_npi, payer_external_id, clearinghouse, transaction, state) values
  ('11111111-1111-1111-1111-111111111111', '1999999984', '00123', 'stedi', 'era', 'approved'),
  ('22222222-2222-2222-2222-222222222222', '1999999984', '00123', 'stedi', 'era', 'pending');
insert into payment_transactions(tenant_id, account_key, amount_cents, method, provider) values
  ('11111111-1111-1111-1111-111111111111', 'MEMBER-A', 2500, 'card', 'mock'),
  ('22222222-2222-2222-2222-222222222222', 'MEMBER-B', 3000, 'card', 'mock');
insert into tasks(tenant_id, source, title, dollars_cents) values
  ('11111111-1111-1111-1111-111111111111', 'denial', 'Appeal A', 10000),
  ('22222222-2222-2222-2222-222222222222', 'balance', 'Collect B', 5000);
insert into audit_log(tenant_id, action, resource) values
  ('11111111-1111-1111-1111-111111111111', 'write', 'seed'),
  ('22222222-2222-2222-2222-222222222222', 'write', 'seed');

-- ── Act as tenant 1's user ──────────────────────────────────────────────────
set role authenticated;
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

do $$ begin
  if current_tenant_id() <> '11111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'FAIL: current_tenant_id() wrong for u1: %', current_tenant_id();
  end if;
  if (select count(*) from claims) <> 1 then
    raise exception 'FAIL: u1 sees % claims, expected 1', (select count(*) from claims);
  end if;
  if (select control_number from claims) <> 'C1' then
    raise exception 'FAIL: u1 sees the wrong claim';
  end if;
  if (select count(*) from claim_lines) <> 1 then
    raise exception 'FAIL: child-table isolation broken — u1 sees % claim_lines', (select count(*) from claim_lines);
  end if;
  if (select count(*) from payers) <> 1 then
    raise exception 'FAIL: u1 cannot read the shared payers catalog';
  end if;
  -- Operational tables: each must show exactly tenant 1's single row.
  if (select count(*) from eligibility_checks) <> 1 then
    raise exception 'FAIL: eligibility_checks isolation — u1 sees %', (select count(*) from eligibility_checks);
  end if;
  if (select count(*) from transaction_enrollments) <> 1 then
    raise exception 'FAIL: transaction_enrollments isolation — u1 sees %', (select count(*) from transaction_enrollments);
  end if;
  if (select count(*) from payment_transactions) <> 1 then
    raise exception 'FAIL: payment_transactions isolation — u1 sees %', (select count(*) from payment_transactions);
  end if;
  if (select count(*) from tasks) <> 1 then
    raise exception 'FAIL: tasks isolation — u1 sees %', (select count(*) from tasks);
  end if;
  if (select count(*) from audit_log) <> 1 then
    raise exception 'FAIL: audit_log isolation — u1 sees %', (select count(*) from audit_log);
  end if;
end $$;

-- A cross-tenant write must be rejected by WITH CHECK.
do $$
declare rejected boolean := false;
begin
  begin
    insert into claims(tenant_id, payer_id, control_number, source_adapter)
      values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'HACK', 'edi');
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: u1 was allowed to insert a row into tenant 2';
  end if;
end $$;

-- ── Act as tenant 2's user ──────────────────────────────────────────────────
set request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
do $$ begin
  if (select count(*) from claims) <> 1 then
    raise exception 'FAIL: u2 sees % claims, expected 1', (select count(*) from claims);
  end if;
  if (select control_number from claims) <> 'C2' then
    raise exception 'FAIL: u2 sees the wrong claim';
  end if;
end $$;

reset role;

-- ── Audit log is append-only ────────────────────────────────────────────────
-- Tested as the owner (RLS-exempt) so rows ARE visible: the immutability trigger,
-- not RLS, is what must reject the mutation. This proves even the service role
-- cannot rewrite the audit trail.
do $$
declare blocked_update boolean := false;
        blocked_delete boolean := false;
begin
  begin
    update audit_log set action = 'tamper';
  exception when others then blocked_update := true;
  end;
  if not blocked_update then
    raise exception 'FAIL: audit_log UPDATE was allowed — immutability trigger missing';
  end if;
  begin
    delete from audit_log;
  exception when others then blocked_delete := true;
  end;
  if not blocked_delete then
    raise exception 'FAIL: audit_log DELETE was allowed — immutability trigger missing';
  end if;
end $$;

select 'RLS ISOLATION TESTS PASSED' as result;
