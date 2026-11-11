import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Remittance } from '../lib/canonical'
import { MockTebraSource } from '../lib/adapters/tebra'
import { deleteRunForControlNumbers, loadPaidByControl, type PriorPaid } from '../lib/db/repository'
import type { Queryable } from '../lib/db/sql'
import { resolveSyncTenant } from '../lib/db/tenant'
import { detectPaymentRegressions } from '../lib/found-money/regressions'
import { nightlyWindow, syncTebraWindow } from '../lib/sync/tebra'

type Answer = { rows?: unknown[]; rowCount?: number } | undefined
type Logged = { sql: string; params?: unknown[] }

/** A Queryable that records every statement and answers from a script. */
function fakeDb(answer: (sql: string, params: unknown[] | undefined, log: Logged[]) => Answer = () => undefined) {
  const log: Logged[] = []
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      const entry = { sql: sql.replace(/\s+/g, ' ').trim(), params }
      log.push(entry)
      const a = answer(entry.sql, params, log) ?? {}
      return { rows: a.rows ?? [], rowCount: a.rowCount ?? 0 }
    },
  } as unknown as Queryable
  return { db, log }
}

/** Enough of a store for persistRun to run end to end: ids for inserts, line numbers for claim lines. */
function fakeStore(priorPaid: { control: string; cpt: string; modifiers: string[]; paid: number }[] = []) {
  let seq = 0
  return fakeDb((sql, params) => {
    if (/^select c\.control_number, cl\.cpt_hcpcs/.test(sql)) {
      return { rows: priorPaid.map((p) => ({ control_number: p.control, cpt_hcpcs: p.cpt, modifiers: p.modifiers, paid_cents: String(p.paid) })) }
    }
    if (/^delete from "?claims"? /.test(sql) || /^delete from claims /.test(sql)) return { rowCount: priorPaid.length ? 1 : 0 }
    if (/^insert into "claim_lines"/.test(sql)) {
      const n = (params?.length ?? 0) / 7
      return { rows: Array.from({ length: n }, (_, i) => ({ id: `line-${++seq}`, line_number: params![i * 7 + 1] })) }
    }
    if (/returning id/.test(sql)) return { rows: [{ id: `id-${++seq}` }] }
    return undefined
  })
}

const MEDICARE = { externalId: 'MEDICARE', name: 'Medicare' }

test('detectPaymentRegressions: a payment that went down is a takeback, attributed to the line when possible', () => {
  const previous = new Map<string, PriorPaid>([
    ['E-1', { totalPaidCents: 9300, lines: new Map([['99214|', 9000], ['36415|', 300]]) }],
    ['E-2', { totalPaidCents: 5000, lines: new Map() }],
    ['E-3', { totalPaidCents: 4000, lines: new Map([['99213|', 4000]]) }],
  ])
  const current: Remittance[] = [
    { claimControlNumber: 'E-1', payerClaimControlNumber: '', payer: MEDICARE, claimStatusCode: '1', totalBilledCents: 17500, totalPaidCents: 300, patientRespCents: 0,
      lines: [
        { cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 0, allowedCents: 0, patientRespCents: 0, adjustments: [] },
        { cptHcpcs: '36415', modifiers: [], units: 1, billedCents: 2500, paidCents: 300, allowedCents: 300, patientRespCents: 0, adjustments: [] },
      ] },
    // E-2 vanished from the pull entirely; E-3 went UP (not a regression).
    { claimControlNumber: 'E-3', payerClaimControlNumber: '', payer: MEDICARE, claimStatusCode: '1', totalBilledCents: 12000, totalPaidCents: 4500, patientRespCents: 0,
      lines: [{ cptHcpcs: '99213', modifiers: [], units: 1, billedCents: 12000, paidCents: 4500, allowedCents: 4500, patientRespCents: 0, adjustments: [] }] },
  ]
  const r = detectPaymentRegressions(previous, current)
  assert.deepEqual(
    r.map((x) => [x.claimControlNumber, x.cptHcpcs, x.previousPaidCents, x.currentPaidCents, x.deltaCents]),
    [
      ['E-1', '99214', 9000, 0, -9000],
      ['E-2', undefined, 5000, 0, -5000],
    ],
  )
})

test('deleteRunForControlNumbers: dependents first, tenant-scoped, one parameter list', async () => {
  const { db, log } = fakeDb((sql) => (/^delete from claims /.test(sql) ? { rowCount: 2 } : undefined))
  const removed = await deleteRunForControlNumbers(db, 'tenant-1', ['A', 'B'])
  assert.equal(removed, 2)
  assert.deepEqual(
    log.map((l) => /^delete from (\w+)/.exec(l.sql)?.[1]),
    ['ledger_entries', 'findings', 'adjustments', 'remittance_lines', 'remittances', 'claim_lines', 'claims'],
  )
  for (const l of log) {
    assert.deepEqual(l.params, ['tenant-1', 'A', 'B'])
    assert.match(l.sql, /tenant_id = \$1/)
    assert.match(l.sql, /control_number in \(\$2, \$3\)/)
  }
  const { db: empty, log: none } = fakeDb()
  assert.equal(await deleteRunForControlNumbers(empty, 'tenant-1', []), 0)
  assert.equal(none.length, 0)
})

test('loadPaidByControl: sums bigint strings per claim and per line key', async () => {
  const { db } = fakeDb(() => ({
    rows: [
      { control_number: 'E-1', cpt_hcpcs: '99214', modifiers: [], paid_cents: '9000' },
      { control_number: 'E-1', cpt_hcpcs: '36415', modifiers: [], paid_cents: '300' },
      { control_number: 'E-2', cpt_hcpcs: null, modifiers: null, paid_cents: '5000' },
    ],
  }))
  const m = await loadPaidByControl(db, 't', ['E-1', 'E-2'])
  assert.equal(m.get('E-1')?.totalPaidCents, 9300)
  assert.equal(m.get('E-1')?.lines.get('99214|'), 9000)
  assert.equal(m.get('E-2')?.totalPaidCents, 5000)
  assert.equal(m.get('E-2')?.lines.size, 0)
  assert.equal((await loadPaidByControl(db, 't', [])).size, 0)
})

test('syncTebraWindow: pull → diff → replace → audit, with takebacks against the stored baseline', async () => {
  const now = new Date('2026-02-14T07:00:00Z')
  const first = fakeStore()
  const s1 = await syncTebraWindow({ source: new MockTebraSource(), db: first.db, tenantId: 'tenant-1', query: { serviceDateFrom: '2026-01-15' }, live: true, now })
  assert.equal(s1.rows, 7)
  assert.equal(s1.encounters, 4)
  assert.equal(s1.adjudicated, 3)
  assert.equal(s1.findings, 4)
  assert.equal(s1.recoverableCents, 27800)
  assert.equal(s1.regressions.length, 0)
  assert.equal(s1.workbench.items.length, 6)
  assert.equal(s1.persisted.claims, 4)
  assert.equal(s1.persisted.replaced, 0)
  const audits = first.log.filter((l) => /insert into audit_log/.test(l.sql)).map((l) => l.params?.[3])
  assert.deepEqual(audits, ['tebra_charges', 'persist_run']) // the PHI read, then the write
  // Deletes ran before inserts, inside the same connection.
  const firstDelete = first.log.findIndex((l) => /^delete from/.test(l.sql))
  const firstInsert = first.log.findIndex((l) => /^insert into "claims"/.test(l.sql))
  assert.ok(firstDelete >= 0 && firstDelete < firstInsert)

  // Second sync: last time Medicare had paid $150 on E-2001's 99214; now it is $90 → a $60 takeback.
  const second = fakeStore([{ control: 'E-2001', cpt: '99214', modifiers: [], paid: 15000 }, { control: 'E-2001', cpt: '36415', modifiers: [], paid: 300 }])
  const s2 = await syncTebraWindow({ source: new MockTebraSource(), db: second.db, tenantId: 'tenant-1', query: { serviceDateFrom: '2026-01-15' }, live: false, now })
  assert.deepEqual(s2.regressions.map((g) => [g.claimControlNumber, g.cptHcpcs, g.deltaCents]), [['E-2001', '99214', -6000]])
  assert.equal(s2.persisted.replaced, 1)
  const takeback = s2.workbench.items.find((i) => i.category === 'recoupment')!
  assert.equal(takeback.amountCents, 6000)
  assert.equal(takeback.claimLineId, 'E-2001:1')
  assert.match(takeback.action, /took back \$60\.00/)
  assert.ok(!second.log.some((l) => /insert into audit_log/.test(l.sql) && l.params?.[3] === 'tebra_charges')) // mock pulls are not PHI reads
})

test('nightlyWindow: last N modified days inside a 60-posting-day window', () => {
  assert.deepEqual(nightlyWindow(new Date('2026-11-11T07:00:00Z'), 3), {
    modifiedDateFrom: '2026-11-08',
    modifiedDateTo: '2026-11-11',
    postingDateFrom: '2026-09-13',
    postingDateTo: '2026-11-11',
  })
})

test('resolveSyncTenant: SYNC_TENANT_ID wins; otherwise the only tenant; never a guess', async () => {
  const one = fakeDb((sql) => (/limit 2/.test(sql) ? { rows: [{ id: 'only' }] } : { rows: [{ id: 'cfg' }] }))
  assert.equal(await resolveSyncTenant(one.db, { SYNC_TENANT_ID: 'cfg' }), 'cfg')
  assert.equal(await resolveSyncTenant(one.db, {}), 'only')
  const missing = fakeDb(() => ({ rows: [] }))
  await assert.rejects(resolveSyncTenant(missing.db, { SYNC_TENANT_ID: 'nope' }), /does not match/)
  await assert.rejects(resolveSyncTenant(missing.db, {}), /No tenant exists/)
  const two = fakeDb(() => ({ rows: [{ id: 'a' }, { id: 'b' }] }))
  await assert.rejects(resolveSyncTenant(two.db, {}), /More than one tenant/)
})
