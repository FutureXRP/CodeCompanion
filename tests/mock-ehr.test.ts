import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pullClaims, adjudicate, mockEhrRates } from '../lib/mock-ehr'
import { scrubClaim, OKLAHOMA } from '../lib/scrub'
import { buildLedger } from '../lib/ledger'
import { runDiff } from '../lib/diff'

test('the mock EHR pulls a full clinic-day of canonical claims', () => {
  const claims = pullClaims()
  assert.equal(claims.length, 15)
  assert.equal(claims[0].controlNumber, 'pt01')
  assert.equal(claims[0].subscriber?.memberId, '1EG4TE5MK73')
  assert.ok(claims.every((c) => c.totalBilledCents > 0 && c.lines.length > 0))
})

test('the mock payer adjudicates with contractual write-offs and patient responsibility', () => {
  const claims = pullClaims()
  const remits = adjudicate(claims, mockEhrRates())
  // pt01: 99214 allowed $115 (CO $60, 20% coins $23, paid $92); 36415 allowed $14 (CO $11, coins $2.80, paid $11.20).
  const pt01 = remits.find((r) => r.claimControlNumber === 'pt01')!
  assert.equal(pt01.totalPaidCents, 10320) // 9200 + 1120
  assert.equal(pt01.patientRespCents, 2580) // 2300 + 280
  assert.ok(pt01.lines[0].adjustments.some((a) => a.groupCode === 'CO'))
  assert.ok(pt01.lines[0].adjustments.some((a) => a.groupCode === 'PR'))
})

test('a 99215 high-complexity visit is denied (auth) for the worklist to appeal', () => {
  const remits = adjudicate(pullClaims(), mockEhrRates())
  const pt06 = remits.find((r) => r.claimControlNumber === 'pt06')!
  assert.equal(pt06.totalPaidCents, 0)
  assert.ok(pt06.lines[0].adjustments.some((a) => a.groupCode === 'CO' && a.carcCode === '197'))
})

test('the day produces real patient balances in the ledger', () => {
  const claims = pullClaims()
  const ledger = buildLedger({ claims, remittances: adjudicate(claims, mockEhrRates()) })
  assert.ok(ledger.totals.patientArCents > 0) // copays + coinsurance land on patients
  assert.ok(ledger.totals.contractualAdjCents > 0) // and contractual write-offs are booked
  assert.equal(ledger.accounts.length, 15)
})

test('the scrubber catches the modifier-25 case and clears the correct one', () => {
  const claims = pullClaims()
  const pt04 = scrubClaim(claims.find((c) => c.controlNumber === 'pt04')!, OKLAHOMA) // 99214 + 93000, no mod 25
  assert.ok(pt04.findings.some((f) => f.code === 'CCI-25'))
  const pt02 = scrubClaim(claims.find((c) => c.controlNumber === 'pt02')!, OKLAHOMA) // 99214 has mod 25
  assert.ok(!pt02.findings.some((f) => f.code === 'CCI-25'))
})

test('found-money surfaces the denial as recoverable', () => {
  const claims = pullClaims()
  const findings = runDiff(claims, adjudicate(claims, mockEhrRates()), mockEhrRates())
  assert.ok(findings.some((f) => f.type === 'denial' && f.claimControlNumber === 'pt06'))
})
