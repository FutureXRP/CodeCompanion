import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildScorecard, type ScorecardClaim, type ScorecardFinding } from '../lib/analytics/scorecard'
import { MockTebraSource } from '../lib/adapters/tebra'
import { loadScorecardInputs } from '../lib/db/repository'
import { toClaimRow, toFindingRow } from '../lib/db/mappers'
import type { Queryable } from '../lib/db/sql'
import { runTebraFoundMoney } from '../lib/found-money/tebra'
import { baselineFiles, migrationPaths, parseArgs, selectMigrations } from '../scripts/db-migrate'

async function mockInputs(): Promise<{ claims: ScorecardClaim[]; findings: ScorecardFinding[] }> {
  const r = await runTebraFoundMoney(new MockTebraSource(), { serviceDateFrom: '2026-01-15' })
  const paid = new Map(r.remittances.map((x) => [x.claimControlNumber, x.totalPaidCents]))
  return {
    claims: r.claims.map((c) => ({ controlNumber: c.controlNumber, dateOfService: c.dateOfService, payerName: c.payer.name, billedCents: c.totalBilledCents, paidCents: paid.get(c.controlNumber) ?? 0, adjudicated: paid.has(c.controlNumber) })),
    findings: r.report.findings.map((f) => ({ controlNumber: f.claimControlNumber, dateOfService: f.dateOfService, type: f.type, status: f.status, recoverableCents: f.recoverableCents, appealable: f.appealable })),
  }
}

test('buildScorecard: totals, rates and buckets from the mock Tebra day', async () => {
  const { claims, findings } = await mockInputs()
  const s = buildScorecard(claims, findings)
  assert.deepEqual(s.totals, {
    claims: 4,
    billedCents: 74000,
    paidCents: 17700,
    grossCollectionRate: 0.2392,
    adjudicatedRate: 0.75,
    denialRate: 0.25,
    unansweredRate: 0.25,
    openRecoverableCents: 27800,
    appealingCents: 0,
    recoveredCents: 0,
    appealableDenialCents: 12800,
    openFindings: 4,
  })
  assert.deepEqual(
    s.byPayer.map((b) => [b.key, b.claims, b.billedCents, b.paidCents, b.denials, b.unanswered, b.openRecoverableCents]),
    [
      ['SoonerCare', 1, 21000, 0, 1, 0, 12800],
      ['Blue Cross Blue Shield of Oklahoma', 1, 19000, 0, 0, 1, 13500],
      ['Medicare', 1, 17500, 9300, 0, 0, 0],
      ['Aetna', 1, 16500, 8400, 0, 0, 1500],
    ],
  )
  assert.deepEqual(s.byMonth.map((b) => [b.key, b.claims, b.openRecoverableCents]), [['2026-01', 4, 27800]])
  // Status drives the money columns: appealing stays open; recovered leaves it.
  const moved = findings.map((f) => (f.type === 'denial' ? { ...f, status: 'appealing' as const } : f.type === 'underpayment' ? { ...f, status: 'recovered' as const } : f))
  const t = buildScorecard(claims, moved).totals
  assert.equal(t.appealingCents, 12800)
  assert.equal(t.recoveredCents, 1500)
  assert.equal(t.openRecoverableCents, 26300)
  assert.deepEqual(buildScorecard([], []).totals.grossCollectionRate, 0)
})

test('loadScorecardInputs: the two queries, bigint strings and dates normalized', async () => {
  const log: string[] = []
  const db = {
    query: async (sql: string) => {
      log.push(sql.replace(/\s+/g, ' ').trim())
      if (/from claims c/.test(sql)) return { rows: [{ control_number: 'E-1', date_of_service: new Date('2026-01-15T00:00:00Z'), total_billed_cents: '17500', payer_name: 'Medicare', paid_cents: '9300', remit_lines: '2' }], rowCount: 1 }
      return { rows: [{ type: 'denial', status: 'open', recoverable_cents: '12800', appealable: true, control_number: 'E-1', date_of_service: '2026-01-15' }], rowCount: 1 }
    },
  } as unknown as Queryable
  const { claims, findings } = await loadScorecardInputs(db, 't')
  assert.deepEqual(claims, [{ controlNumber: 'E-1', dateOfService: '2026-01-15', payerName: 'Medicare', billedCents: 17500, paidCents: 9300, adjudicated: true }])
  assert.deepEqual(findings, [{ controlNumber: 'E-1', dateOfService: '2026-01-15', type: 'denial', status: 'open', recoverableCents: 12800, appealable: true }])
  assert.match(log[0], /left join remittance_lines rl/)
  assert.match(log[1], /f\.recoverable_cents/)
})

test('mappers carry the 013 columns', () => {
  const row = toClaimRow('t', null, { controlNumber: 'C', payer: { externalId: 'X', name: 'X' }, diagnoses: [], dateOfService: '2026-01-15', totalBilledCents: 100, sourceAdapter: 'tebra', lines: [] })
  assert.equal(row.date_of_service, '2026-01-15')
  const f = toFindingRow('t', null, { id: 'denial:C:1', type: 'denial', claimControlNumber: 'C', claimLineId: 'C:1', payerName: 'X', payerExternalId: 'X', cptHcpcs: '99213', modifiers: [], expectedCents: 100, actualCents: 0, deltaCents: 100, recoverableCents: 100, appealable: true, status: 'open', reason: 'r', detectedAt: 'now' })
  assert.equal(f.recoverable_cents, 100)
})

test('db-migrate: tracked selection, --only, --reset, --baseline', () => {
  const all = migrationPaths(process.cwd())
  const names = all.map((f) => f.split(/[\\/]/).pop()!)
  assert.ok(names.includes('013_scorecard_columns.sql'))

  assert.deepEqual(parseArgs(['--only=013']), { reset: false, only: '013', baseline: undefined })
  assert.deepEqual(parseArgs(['--baseline=010']), { reset: false, only: undefined, baseline: '010' })
  assert.deepEqual(parseArgs(['--baseline']), { reset: false, only: undefined, baseline: true })
  assert.deepEqual(parseArgs(['--reset']), { reset: true, only: undefined, baseline: undefined })

  const applied = new Set(names.filter((n) => n < '011' || n.startsWith('000_') || n.startsWith('zzz_')))
  const pending = selectMigrations(all, applied, { reset: false }).map((f) => f.split(/[\\/]/).pop()!)
  assert.deepEqual(pending, ['011_tebra_source_adapter.sql', '012_tasks_source_key.sql', '013_scorecard_columns.sql', '014_rls_force.sql'])
  assert.equal(selectMigrations(all, new Set(names), { reset: false }).length, 0)
  assert.equal(selectMigrations(all, new Set(names), { reset: true }).length, all.length)
  assert.equal(selectMigrations(all, new Set(), { reset: false, only: '012' }).length, 1)
  assert.throws(() => selectMigrations(all, new Set(), { reset: false, only: '999' }), /matched no migration/)

  const base = baselineFiles(all, '010').map((f) => f.split(/[\\/]/).pop()!)
  assert.ok(base.includes('000_compat.sql') && base.includes('zzz_rls_guc.sql') && base.includes('010_feature_flags.sql') && base.includes('001_initial_schema.sql'))
  assert.ok(!base.includes('011_tebra_source_adapter.sql'))
  assert.equal(baselineFiles(all, true).length, all.length)
})
