import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim } from '../lib/canonical'
import { sampleEncounter, encounterToClaim } from '../lib/adapters/ehr'
import { canonicalToStediClaim } from '../lib/rcm/stedi-clearinghouse'

test('encounterToClaim maps an EHR encounter to an enriched canonical claim', () => {
  const claim = encounterToClaim(sampleEncounter('STEDITEST'))
  assert.equal(claim.controlNumber, 'ENC0001')
  assert.equal(claim.subscriber?.memberId, 'TEST123456789')
  assert.equal(claim.billingProvider?.npi, '1234567893')
  assert.equal(claim.lines.length, 2)
  assert.equal(claim.lines[0].id, 'ENC0001:1')
  assert.equal(claim.totalBilledCents, 17500) // $150.00 + $25.00
})

test('canonicalToStediClaim builds a test-mode Stedi payload from a canonical claim', () => {
  const claim = encounterToClaim(sampleEncounter('STEDITEST'))
  const payload = canonicalToStediClaim(claim, { tradingPartnerServiceId: 'STEDITEST', usageIndicator: 'T' }) as {
    usageIndicator: string
    tradingPartnerServiceId: string
    subscriber: { memberId: string }
    providers: { providerType: string }[]
    claimInformation: { claimChargeAmount: string; serviceLines: unknown[] }
  }
  assert.equal(payload.usageIndicator, 'T') // test mode, never production
  assert.equal(payload.tradingPartnerServiceId, 'STEDITEST')
  assert.equal(payload.subscriber.memberId, 'TEST123456789')
  assert.equal(payload.providers[0].providerType, 'BillingProvider')
  assert.equal(payload.claimInformation.claimChargeAmount, '175.00')
  assert.equal(payload.claimInformation.serviceLines.length, 2)
})

test('canonicalToStediClaim refuses a claim without subscriber + billing provider', () => {
  const bare: Claim = {
    controlNumber: 'X',
    payer: { externalId: 'P', name: 'Test' },
    diagnoses: [],
    totalBilledCents: 0,
    sourceAdapter: 'edi',
    lines: [],
  }
  assert.throws(() => canonicalToStediClaim(bare, { tradingPartnerServiceId: 'STEDITEST' }), /subscriber is required/)
})
