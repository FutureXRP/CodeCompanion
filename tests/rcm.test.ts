import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSampleClaims, generate837, parse837 } from '../lib/adapters/edi'
import { loadFeeSchedule } from '../lib/adapters/fee-schedule'
import { MockClearinghouse, validateClaim } from '../lib/rcm/clearinghouse'
import { runRcmCycle } from '../lib/rcm/run'

test('generate837 keeps the ISA component separator consistent (":")', () => {
  const edi = generate837(loadSampleClaims())
  assert.ok(edi.startsWith('ISA*'))
  assert.match(edi, /\*P\*:~/) // ISA15=P, ISA16=':'
})

test('837 generation round-trips through the parser', () => {
  const original = loadSampleClaims()
  const reparsed = parse837(generate837(original))
  assert.equal(reparsed.length, original.length)
  for (const claim of original) {
    const got = reparsed.find((c) => c.controlNumber === claim.controlNumber)
    assert.ok(got, `missing claim ${claim.controlNumber}`)
    assert.equal(got.totalBilledCents, claim.totalBilledCents)
    assert.equal(got.payer.externalId, claim.payer.externalId)
    assert.deepEqual(got.diagnoses, claim.diagnoses)
    assert.equal(got.lines.length, claim.lines.length)
    claim.lines.forEach((line, i) => {
      assert.equal(got.lines[i].cptHcpcs, line.cptHcpcs)
      assert.equal(got.lines[i].billedCents, line.billedCents)
      assert.equal(got.lines[i].units, line.units)
      assert.deepEqual(got.lines[i].diagnosisPointers, line.diagnosisPointers)
    })
  }
})

test('validateClaim rejects claims a clearinghouse would bounce', () => {
  const [claim] = loadSampleClaims()
  assert.equal(validateClaim(claim).ok, true)
  assert.equal(validateClaim({ ...claim, lines: [] }).ok, false)
})

test('mock clearinghouse accepts valid claims and assigns control numbers', () => {
  const ch = new MockClearinghouse(loadFeeSchedule())
  const acks = ch.submit(generate837(loadSampleClaims()))
  assert.equal(acks.length, 3)
  assert.ok(acks.every((a) => a.status === 'accepted' && a.payerClaimControlNumber))
})

test('full RCM cycle: submitted, adjudicated, lifecycle + worklist derived', () => {
  const r = runRcmCycle()
  assert.equal(r.totals.accepted, 3)
  assert.equal(r.totals.rejected, 0)
  assert.equal(r.totals.denied, 1) // 99215 -> simulated prior-auth denial
  assert.equal(r.totals.paid, 2)
  const denied = r.claims.find((c) => c.status === 'denied')
  assert.equal(denied?.claimControlNumber, 'PATIENT002')
  // recovery worklist = appealable denial ($160) + undercoding flag ($20)
  assert.equal(r.totals.recoverableCents, 18000)
})
