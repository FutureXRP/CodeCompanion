import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim, Finding, Remittance } from '../lib/canonical'
import { buildWorklist } from '../lib/rcm/worklist'
import type { SubmissionAck } from '../lib/rcm/clearinghouse'

function claim(cn: string): Claim {
  return { controlNumber: cn, payer: { externalId: 'P', name: 'Test Payer' }, diagnoses: ['E1165'], totalBilledCents: 10000, sourceAdapter: 'edi', lines: [] }
}

function finding(partial: Partial<Finding> & Pick<Finding, 'type' | 'claimControlNumber'>): Finding {
  return {
    id: `${partial.type}:${partial.claimControlNumber}:1`,
    claimLineId: `${partial.claimControlNumber}:1`,
    payerName: 'Test Payer',
    payerExternalId: 'P',
    cptHcpcs: '99214',
    modifiers: [],
    expectedCents: 10000,
    actualCents: 0,
    deltaCents: 10000,
    recoverableCents: 10000,
    appealable: true,
    status: 'open',
    reason: 'because',
    detectedAt: '2026-06-18T00:00:00Z',
    ...partial,
  }
}

function remit(cn: string, icn: string): Remittance {
  return { claimControlNumber: cn, payerClaimControlNumber: icn, payer: { externalId: 'P', name: 'Test Payer' }, claimStatusCode: '4', totalBilledCents: 10000, totalPaidCents: 0, patientRespCents: 0, lines: [] }
}

test('a 277CA rejection routes to fix & resubmit, no ICN (no claim on file)', () => {
  const acks: SubmissionAck[] = [{ claimControlNumber: 'C1', status: 'rejected', rejectReason: 'Missing payer id' }]
  const items = buildWorklist({ claims: [claim('C1')], acks, remittances: [], findings: [] })
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, 'rejection')
  assert.equal(items[0].action, 'fix_resubmit')
  assert.equal(items[0].needsIcn, false)
  assert.match(items[0].reason, /new original/i)
})

test('an appealable denial routes to appeal and carries the payer ICN', () => {
  const items = buildWorklist({
    claims: [claim('C2')],
    acks: [],
    remittances: [remit('C2', 'ICN-C2')],
    findings: [finding({ type: 'denial', claimControlNumber: 'C2', carcCode: '197', appealable: true })],
  })
  assert.equal(items[0].kind, 'denial')
  assert.equal(items[0].action, 'appeal')
  assert.equal(items[0].needsIcn, true)
  assert.equal(items[0].payerClaimControlNumber, 'ICN-C2')
})

test('a fixable claim-error denial (CARC 16) routes to correct & replace', () => {
  const items = buildWorklist({
    claims: [claim('C3')],
    acks: [],
    remittances: [remit('C3', 'ICN-C3')],
    findings: [finding({ type: 'denial', claimControlNumber: 'C3', carcCode: '16', appealable: true })],
  })
  assert.equal(items[0].action, 'correct_resubmit')
  assert.equal(items[0].needsIcn, true)
  assert.equal(items[0].payerClaimControlNumber, 'ICN-C3')
})

test('a non-appealable denial routes to write off, no ICN needed', () => {
  const items = buildWorklist({
    claims: [claim('C4')],
    acks: [],
    remittances: [remit('C4', 'ICN-C4')],
    findings: [finding({ type: 'denial', claimControlNumber: 'C4', carcCode: '96', appealable: false, recoverableCents: 0 })],
  })
  assert.equal(items[0].action, 'write_off')
  assert.equal(items[0].needsIcn, false)
})

test('unadjudicated routes to follow up; the queue ranks by recoverable dollars', () => {
  const items = buildWorklist({
    claims: [claim('C5'), claim('C6')],
    acks: [],
    remittances: [],
    findings: [
      finding({ type: 'unadjudicated', claimControlNumber: 'C5', appealable: false, recoverableCents: 5000 }),
      finding({ type: 'underpayment', claimControlNumber: 'C6', recoverableCents: 9000 }),
    ],
  })
  assert.equal(items[0].claimControlNumber, 'C6') // higher recoverable leads
  assert.equal(items[0].action, 'appeal')
  const followup = items.find((i) => i.kind === 'unadjudicated')
  assert.equal(followup?.action, 'follow_up')
  assert.equal(followup?.needsIcn, false)
})
