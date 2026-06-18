import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Remittance } from '../lib/canonical'
import { buildSecondaryClaim, secondaryBalanceCents } from '../lib/rcm/cob'
import { generate837 } from '../lib/adapters/edi'
import { canonicalToStediClaim } from '../lib/rcm/stedi-clearinghouse'
import { encounterToClaim, sampleEncounter } from '../lib/adapters/ehr'

const primary = () => encounterToClaim(sampleEncounter('STEDITEST')) // 99214 + 36415, total $175

const primaryRemit: Remittance = {
  claimControlNumber: 'ENC0001',
  payerClaimControlNumber: 'PCN1',
  payer: { externalId: 'STEDITEST', name: 'Stedi Test Payer' },
  claimStatusCode: '1',
  totalBilledCents: 17500,
  totalPaidCents: 12000,
  patientRespCents: 3000,
  lines: [
    { cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 11000, allowedCents: 14000, patientRespCents: 3000, adjustments: [
      { groupCode: 'CO', carcCode: '45', amountCents: 1000 },
      { groupCode: 'PR', carcCode: '2', amountCents: 3000 },
    ] },
    { cptHcpcs: '36415', modifiers: [], units: 1, billedCents: 2500, paidCents: 1000, allowedCents: 1000, patientRespCents: 0, adjustments: [
      { groupCode: 'CO', carcCode: '45', amountCents: 1500 },
    ] },
  ],
}

const secondary = { externalId: 'BCBSOK', name: 'BCBS Oklahoma' }

test('buildSecondaryClaim records the primary as the other payer with its line adjudication', () => {
  const s = buildSecondaryClaim(primary(), primaryRemit, secondary, { claimFilingCode: 'CI' })
  assert.equal(s.payer.externalId, 'BCBSOK')
  assert.equal(s.controlNumber, 'ENC0001-S')
  assert.equal(s.claimFrequencyCode, '1') // a new original to the secondary payer
  assert.equal(s.claimFilingCode, 'CI')
  assert.ok(s.otherPayers && s.otherPayers.length === 1)
  const op = s.otherPayers![0]
  assert.equal(op.sequence, 'P')
  assert.equal(op.payer.externalId, 'STEDITEST')
  assert.equal(op.paidCents, 12000)
  assert.equal(op.lineAdjudications?.length, 2)
  assert.equal(op.lineAdjudications![0].paidCents, 11000)
})

test('secondaryBalanceCents carries the primary patient responsibility', () => {
  assert.equal(secondaryBalanceCents(primaryRemit), 3000)
})

test('generate837 emits the COB loop (SBR*S + AMT*D) for a secondary claim', () => {
  const s = buildSecondaryClaim(primary(), primaryRemit, secondary, { claimFilingCode: 'CI' })
  const edi = generate837([s], { submitterId: 'BLAIRPC', controlNumber: '000000010' })
  assert.match(edi, /SBR\*S\*/) // 2000B subscriber sequence = secondary
  assert.match(edi, /AMT\*D\*120\.00/) // primary payer paid amount
})

test('canonicalToStediClaim includes otherSubscriberInformation for COB', () => {
  const s = buildSecondaryClaim(primary(), primaryRemit, secondary, { claimFilingCode: 'CI' })
  const payload = canonicalToStediClaim(s, { tradingPartnerServiceId: 'BCBSOK' }) as {
    claimInformation: { otherSubscriberInformation?: { paymentResponsibilityLevelCode: string; payerPaidAmount: string }[] }
  }
  const osi = payload.claimInformation.otherSubscriberInformation
  assert.ok(osi && osi.length === 1)
  assert.equal(osi![0].paymentResponsibilityLevelCode, 'P')
  assert.equal(osi![0].payerPaidAmount, '120.00')
})
