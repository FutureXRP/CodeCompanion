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
  assert.ok(r.blockers.some((b) => b.id === 'supabase'))
  assert.ok(r.blockers.some((b) => b.id === 'baa'))
})

test('readiness: everything except BAAs/review → automatedPass, not ready', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's',
    ANTHROPIC_API_KEY: 'k', STEDI_API_KEY: 'st',
  }
  const r = goLiveReadiness(env)
  assert.equal(r.automatedPass, true) // code + infra ready
  assert.equal(r.ready, false) // human gates (baa, review) + phi switch remain
  assert.ok(r.blockers.every((b) => ['baa', 'security_review', 'phi_gate'].includes(b.id)))
})

test('readiness: all gates set → ready', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's',
    ANTHROPIC_API_KEY: 'k', STEDI_API_KEY: 'st', ALLOW_REAL_PHI: 'true', BAA_SIGNED: 'true', HIPAA_SECURITY_REVIEW: 'true',
  }
  const r = goLiveReadiness(env)
  assert.equal(r.blockers.length, 0)
  assert.equal(r.ready, true)
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
  }
  assert.ok(checked >= 10, `expected to verify many tenant tables, only saw ${checked}`)
})

test('the behavioral corpus carries no tenant_id column (the de-id boundary)', () => {
  const corpus = readFileSync(join(process.cwd(), 'supabase/migrations/008_corpus.sql'), 'utf8')
  const body = /create table if not exists payer_behavior_corpus\s*\(([\s\S]*?)\n\);/.exec(corpus)
  assert.ok(body, 'corpus table definition found')
  // Check the column definitions only — explanatory comments may say "no tenant_id".
  assert.ok(!/\btenant_id\b/.test(body[1]), 'corpus table body must never define a tenant_id column')
})
