import { test } from 'node:test'
import assert from 'node:assert/strict'

import { encounterToClaim, sampleEncounter } from '../lib/adapters/ehr'
import { correctClaim, voidClaim } from '../lib/rcm/correction'
import { validateClaim } from '../lib/rcm/clearinghouse'
import { generate837, parse837 } from '../lib/adapters/edi'
import { canonicalToStediClaim } from '../lib/rcm/stedi-clearinghouse'

const base = () => encounterToClaim(sampleEncounter('STEDITEST'))

test('correctClaim produces a frequency-7 replacement referencing the ICN', () => {
  const corrected = correctClaim(base(), { payerClaimControlNumber: 'ICN12345' })
  assert.equal(corrected.claimFrequencyCode, '7')
  assert.equal(corrected.originalClaimRef, 'ICN12345')
  assert.equal(corrected.controlNumber, 'ENC0001') // defaults to the original
})

test('correctClaim applies a line edit and recomputes the total', () => {
  const corrected = correctClaim(base(), {
    payerClaimControlNumber: 'ICN12345',
    newControlNumber: 'ENC0001R1',
    revise: (c) => ({
      ...c,
      lines: c.lines.map((l) => (l.cptHcpcs === '99214' ? { ...l, cptHcpcs: '99215', billedCents: 21000 } : l)),
    }),
  })
  assert.equal(corrected.controlNumber, 'ENC0001R1')
  assert.equal(corrected.lines[0].cptHcpcs, '99215')
  assert.equal(corrected.totalBilledCents, 23500) // 21000 (99215) + 2500 (36415)
})

test('voidClaim produces a frequency-8 void referencing the ICN', () => {
  const voided = voidClaim(base(), 'ICN98765')
  assert.equal(voided.claimFrequencyCode, '8')
  assert.equal(voided.originalClaimRef, 'ICN98765')
})

test('correctClaim and voidClaim require the original ICN', () => {
  assert.throws(() => correctClaim(base(), { payerClaimControlNumber: '' }), /ICN/)
  assert.throws(() => voidClaim(base(), ''), /ICN/)
})

test('validateClaim rejects a replacement with no ICN, accepts one with it', () => {
  const bad = validateClaim({ ...base(), claimFrequencyCode: '7' })
  assert.equal(bad.ok, false)
  assert.match(bad.reason ?? '', /ICN/)
  const good = validateClaim(correctClaim(base(), { payerClaimControlNumber: 'ICN1' }))
  assert.equal(good.ok, true)
})

test('generate837 emits REF*F8 + frequency 7, and parse837 round-trips them', () => {
  const corrected = correctClaim(base(), { payerClaimControlNumber: 'ICN777', newControlNumber: 'ENC0001R' })
  const edi = generate837([corrected], { submitterId: 'BLAIRPC', controlNumber: '000000009' })
  assert.match(edi, /REF\*F8\*ICN777/)
  assert.match(edi, /:B:7/) // CLM05-3 frequency code
  const parsed = parse837(edi)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].claimFrequencyCode, '7')
  assert.equal(parsed[0].originalClaimRef, 'ICN777')
})

test('canonicalToStediClaim carries the original claim reference on a replacement', () => {
  const corrected = correctClaim(base(), { payerClaimControlNumber: 'ICN42' })
  const payload = canonicalToStediClaim(corrected, { tradingPartnerServiceId: 'STEDITEST' }) as {
    claimInformation: { claimFrequencyCode: string; claimSupplementalInformation?: { claimControlNumber?: string } }
  }
  assert.equal(payload.claimInformation.claimFrequencyCode, '7')
  assert.equal(payload.claimInformation.claimSupplementalInformation?.claimControlNumber, 'ICN42')
})
