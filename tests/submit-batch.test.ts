import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim } from '../lib/canonical'
import { submitClaimBatch, classifyStediSubmission, type JsonSubmitter } from '../lib/rcm/submit-batch'
import type { StediPayer } from '../lib/rcm/payers'
import { pullClaims } from '../lib/mock-ehr'

const ACCEPT = { status: 200, body: { status: 'SUCCESS', x12: 'ST*277*0001~STC*A1:20:PR*~', controlNumber: 'X' } }
const REJECT_277 = { status: 200, body: { status: 'SUCCESS', x12: 'ST*277*0001~STC*A3:21:PR*~' } }
const REJECT_ERR = { status: 200, body: { status: 'ERROR', errors: [{ message: 'Invalid subscriber member id' }] } }

function fakeCh(respond: () => { status: number; body: unknown }): JsonSubmitter & { calls: unknown[] } {
  const calls: unknown[] = []
  return { calls, submitJson: async (payload: unknown) => { calls.push(payload); return respond() } }
}

// A hermetic stand-in for the bundled Stedi network, so the pre-flight payer check
// is tested without reading the on-disk directory.
function stediPayer(over: Partial<StediPayer> & { payerId: string }): StediPayer {
  return {
    stediId: 'TEST00', name: `Payer ${over.payerId}`, states: ['OK'],
    professionalClaim: true, professionalClaimEnrollmentRequired: false,
    era: true, eraEnrollmentRequired: false, eligibility: false,
    eligibilityEnrollmentRequired: false, claimStatus: true, ...over,
  }
}
const NETWORK: Record<string, StediPayer> = {
  '04312': stediPayer({ payerId: '04312', name: 'Medicare Oklahoma Part B', professionalClaimEnrollmentRequired: true }),
  '00840': stediPayer({ payerId: '00840', name: 'BCBS Oklahoma' }),
}
const resolvePayer = (id: string): StediPayer | undefined => NETWORK[id]

test('classifyStediSubmission reads accept/reject from the 277CA and errors', () => {
  assert.equal(classifyStediSubmission(200, { x12: 'STC*A1:20:PR*' }).outcome, 'accepted')
  assert.equal(classifyStediSubmission(200, { x12: 'STC*A2:20:PR*' }).outcome, 'accepted')
  assert.equal(classifyStediSubmission(200, { x12: 'STC*A3:21:PR*' }).outcome, 'rejected')
  assert.equal(classifyStediSubmission(200, { errors: [{ message: 'bad' }] }).outcome, 'rejected')
  assert.equal(classifyStediSubmission(403, {}).outcome, 'rejected')
})

test('submitClaimBatch scrubs first, then submits clean claims to their real payer', async () => {
  const claims = pullClaims().slice(0, 3)
  const ch = fakeCh(() => ACCEPT)
  const results = await submitClaimBatch(claims, ch, {})
  assert.equal(results.length, 3)
  assert.ok(results.every((r) => r.outcome === 'accepted'))
  assert.equal(ch.calls.length, 3)
  assert.equal(results[0].tradingPartnerServiceId, claims[0].payer.externalId) // real routing
})

test('a scrub-blocked claim is never transmitted', async () => {
  const [clean] = pullClaims()
  const broken: Claim = { ...clean, controlNumber: 'BAD', payer: { externalId: '', name: 'Nobody' } } // REQ-PAYER error
  const ch = fakeCh(() => ACCEPT)
  const results = await submitClaimBatch([broken], ch, {})
  assert.equal(results[0].outcome, 'blocked')
  assert.equal(ch.calls.length, 0)
})

test('useTestPayer routes to STEDITEST; a 277CA A3 maps to rejected for resolution', async () => {
  const claims = pullClaims().slice(0, 1)
  const tp = await submitClaimBatch(claims, fakeCh(() => REJECT_277), { useTestPayer: true })
  assert.equal(tp[0].tradingPartnerServiceId, 'STEDITEST')
  assert.equal(tp[0].outcome, 'rejected')
  assert.equal(tp[0].category, 'A3')

  const err = await submitClaimBatch(claims, fakeCh(() => REJECT_ERR), {})
  assert.equal(err[0].outcome, 'rejected')
  assert.match(err[0].detail, /member id/i)
})

test('an unconfigured payer id is blocked pre-flight, never transmitted', async () => {
  const [clean] = pullClaims()
  const bad: Claim = { ...clean, controlNumber: 'PNC', payer: { externalId: '00123', name: 'Medicare (placeholder)' } }
  const ch = fakeCh(() => ACCEPT)
  const [r] = await submitClaimBatch([bad], ch, { resolvePayer })
  assert.equal(r.outcome, 'blocked')
  assert.match(r.detail, /not in the Stedi payer network/i)
  assert.equal(ch.calls.length, 0) // caught locally — no doomed round-trip
})

test('an accepted claim flags payers that require EDI enrollment for production', async () => {
  const medicare: Claim = { ...pullClaims()[0], payer: { externalId: '04312', name: 'Medicare (Novitas JH)' } }
  const [r] = await submitClaimBatch([medicare], fakeCh(() => ACCEPT), { resolvePayer })
  assert.equal(r.outcome, 'accepted')
  assert.equal(r.enrollmentRequired, true)
  assert.match(r.detail, /enrollment/i)
})

test('useTestPayer bypasses the payer-network check (routes to STEDITEST)', async () => {
  const [clean] = pullClaims()
  const unknown: Claim = { ...clean, payer: { externalId: 'NOPE9', name: 'Unknown' } }
  const ch = fakeCh(() => ACCEPT)
  const [r] = await submitClaimBatch([unknown], ch, { useTestPayer: true, resolvePayer })
  assert.equal(r.outcome, 'accepted')
  assert.equal(r.tradingPartnerServiceId, 'STEDITEST')
  assert.equal(ch.calls.length, 1)
})
