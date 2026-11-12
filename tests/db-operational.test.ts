import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { toEligibilityCheckRow, toEnrollmentRow, toPaymentTransactionRow, toTaskRow } from '../lib/db/operational-mappers'
import { goLiveReadiness } from '../lib/config/readiness'
import type { EligibilityResult } from '../lib/rcm/eligibility'
import type { EnrollmentRecord } from '../lib/rcm/enrollment'
import type { Task } from '../lib/tasks'

// ── Mappers ──────────────────────────────────────────────────────────────────

test('toEligibilityCheckRow maps benefits to cents columns', () => {
  const result: EligibilityResult = {
    status: 'active', active: true,
    payer: { externalId: '60054', name: 'Aetna' },
    member: { memberId: 'M123', firstName: 'Jane', lastName: 'Doe' },
    copayCents: 2500, coinsurancePercent: 0.2, deductibleCents: 150000, deductibleRemainingCents: 50000,
    benefits: [], errors: [], checkedAt: '2026-06-19T00:00:00Z',
  }
  const row = toEligibilityCheckRow('t1', 'payer-uuid', result, 'stedi')
  assert.equal(row.tenant_id, 't1')
  assert.equal(row.account_key, 'M123')
  assert.equal(row.status, 'active')
  assert.equal(row.copay_cents, 2500)
  assert.equal(row.deductible_remaining_cents, 50000)
  assert.equal(row.out_of_pocket_cents, null) // absent → null, not undefined
  assert.equal(row.source, 'stedi')
})

test('toEnrollmentRow + toPaymentTransactionRow + toTaskRow shapes', () => {
  const enr: EnrollmentRecord = { providerNpi: '1234567893', payerExternalId: '04312', clearinghouse: 'stedi', transaction: 'era', state: 'pending' }
  const er = toEnrollmentRow('t1', enr)
  assert.equal(er.clearinghouse, 'stedi')
  assert.equal(er.transaction, 'era')
  assert.equal(er.effective_date, null)

  const pr = toPaymentTransactionRow('t1', null, { accountKey: 'A', amountCents: 3000, method: 'card' }, { ok: true, provider: 'mock', amountCents: 3000, method: 'card', transactionId: 'MOCK-1' })
  assert.equal(pr.amount_cents, 3000)
  assert.equal(pr.provider, 'mock')
  assert.equal(pr.status, 'succeeded')
  assert.equal(pr.external_transaction_id, 'MOCK-1')

  const task: Task = { id: 'x', title: 'Appeal', detail: 'd', source: 'denial', dollarsCents: 12000, assignee: 'Priya', status: 'open', priority: 'high', ageDays: 2, dueInDays: 5, overdue: false, href: '/aging' }
  const tr = toTaskRow('t1', task, '2026-07-01')
  assert.equal(tr.dollars_cents, 12000)
  assert.equal(tr.status, 'open')
  assert.equal(tr.due_date, '2026-07-01')
})

// ── Readiness ────────────────────────────────────────────────────────────────

test('readiness: empty env is not ready, with config+infra blockers', () => {
  const r = goLiveReadiness({})
  assert.equal(r.ready, false)
  assert.equal(r.automatedPass, false)
  assert.ok(r.blockers.some((b) => b.id === 'database'))
  assert.ok(r.blockers.some((b) => b.id === 'supabase'))
  assert.ok(r.blockers.some((b) => b.id === 'baa'))
  assert.ok(!r.blockers.some((b) => b.id === 'clearinghouse')) // the PM runs claims unless Stedi is chosen
})

test('readiness: everything except BAAs/review → automatedPass, not ready', () => {
  const env = {
    DATABASE_URL: 'postgres://neon', NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
    ANTHROPIC_API_KEY: 'k',
  }
  const r = goLiveReadiness(env)
  assert.equal(r.automatedPass, true) // code + infra ready
  assert.equal(r.ready, false) // human gates (baa, review) + phi switch remain
  assert.ok(r.blockers.every((b) => ['baa', 'security_review', 'phi_gate'].includes(b.id)))
})

test('readiness: all gates set → ready', () => {
  const env = {
    DATABASE_URL: 'postgres://app:x@ep.neon.tech/db?sslmode=require', NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
    ANTHROPIC_API_KEY: 'k', ALLOW_REAL_PHI: 'true', BAA_SIGNED: 'true', HIPAA_SECURITY_REVIEW: 'true',
  }
  const r = goLiveReadiness(env)
  assert.equal(r.blockers.length, 0)
  assert.equal(r.ready, true)
})

test('readiness: with real PHI allowed, a plaintext database connection or the Vercel host is a blocker', () => {
  const base = {
    DATABASE_URL: 'postgres://app:x@ep.neon.tech/db', NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
    ANTHROPIC_API_KEY: 'k', ALLOW_REAL_PHI: 'true', BAA_SIGNED: 'true', HIPAA_SECURITY_REVIEW: 'true',
  }
  const plain = goLiveReadiness(base)
  assert.ok(plain.blockers.some((b) => b.id === 'db_tls'))
  assert.ok(plain.blockers.some((b) => b.id === 'phi_hosting'))
  const vercel = goLiveReadiness({ ...base, DATABASE_URL: `${base.DATABASE_URL}?sslmode=require`, VERCEL: '1' })
  assert.ok(vercel.blockers.some((b) => b.id === 'phi_hosting'))
  assert.match(vercel.checks.find((c) => c.id === 'phi_hosting')!.detail, /Vercel/)
  // Synthetic data: the same checks are informational, never blockers.
  const synthetic = goLiveReadiness({ ...base, ALLOW_REAL_PHI: undefined, VERCEL: '1' })
  assert.ok(!synthetic.blockers.some((b) => ['db_tls', 'phi_hosting'].includes(b.id)))
})

test('readiness: Tebra live mode requires its credentials; Stedi only when chosen', () => {
  const base = { DATABASE_URL: 'd', NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a', ANTHROPIC_API_KEY: 'k' }
  const live = goLiveReadiness({ ...base, TEBRA_USE_MOCK: 'false' })
  assert.ok(live.blockers.some((b) => b.id === 'tebra'))
  const creds = goLiveReadiness({ ...base, TEBRA_USE_MOCK: 'false', TEBRA_CUSTOMER_KEY: 'k', TEBRA_USER: 'u', TEBRA_PASSWORD: 'p', TEBRA_PRACTICE_NAME: 'SquareOne Medical' })
  assert.ok(!creds.blockers.some((b) => b.id === 'tebra'))
  assert.equal(creds.checks.find((c) => c.id === 'tebra')?.status, 'pass')
  const stedi = goLiveReadiness({ ...base, CLEARINGHOUSE_PROVIDER: 'stedi' })
  assert.ok(stedi.blockers.some((b) => b.id === 'clearinghouse'))
  assert.equal(goLiveReadiness({ ...base, TEBRA_CONTRACT_EXPORT_PATH: '/x.csv', TEBRA_SYNC_ENABLED: 'true' }).checks.filter((c) => ['contract_rates', 'sync'].includes(c.id)).every((c) => c.status === 'pass'), true)
})

// ── Static RLS guard: every tenant-scoped table must have RLS + a policy ──────

test('every tenant_id table in migrations has RLS enabled + a policy', () => {
  const dir = join(process.cwd(), 'supabase/migrations')
  const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')

  const tableRe = /create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/g
  let m: RegExpExecArray | null
  let checked = 0
  while ((m = tableRe.exec(sql)) !== null) {
    const [, name, body] = m
    if (!/\btenant_id\b/.test(body)) continue // only tenant-scoped tables
    checked += 1
    assert.ok(new RegExp(`alter table ${name} enable row level security`).test(sql), `${name} missing: enable row level security`)
    assert.ok(new RegExp(`create policy \\w+\\s+on ${name}\\b`).test(sql), `${name} missing: a row-level policy`)
    assert.ok(new RegExp(`alter table ${name} force row level security`).test(sql), `${name} missing: force row level security (the owner is exempt otherwise — see 014)`)
  }
  assert.ok(checked >= 10, `expected to verify many tenant tables, only saw ${checked}`)
})

test('every table that enables RLS also forces it, and the service context exists (migration 014)', () => {
  const dir = join(process.cwd(), 'supabase/migrations')
  const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
  const enabled = [...sql.matchAll(/alter table (\w+) enable row level security/g)].map((m) => m[1])
  assert.ok(enabled.length >= 30, `expected many RLS tables, saw ${enabled.length}`)
  for (const name of enabled) {
    assert.ok(new RegExp(`alter table ${name} force row level security`).test(sql), `${name} enables RLS but never forces it`)
  }
  assert.match(sql, /create or replace function app_is_service\(\)/)
  assert.match(sql, /create policy %I on public\.%I for all using \(app_is_service\(\)\) with check \(app_is_service\(\)\)/)
})

test('the behavioral corpus carries no tenant_id column (the de-id boundary)', () => {
  const corpus = readFileSync(join(process.cwd(), 'supabase/migrations/008_corpus.sql'), 'utf8')
  const body = /create table if not exists payer_behavior_corpus\s*\(([\s\S]*?)\n\);/.exec(corpus)
  assert.ok(body, 'corpus table definition found')
  // Check the column definitions only — explanatory comments may say "no tenant_id".
  assert.ok(!/\btenant_id\b/.test(body[1]), 'corpus table body must never define a tenant_id column')
})
