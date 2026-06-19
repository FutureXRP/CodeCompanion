import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ingestFhirBundle } from '../lib/adapters/fhir'
import { encounterToClaim } from '../lib/adapters/ehr'
import { mockEhrDay } from '../lib/mock-ehr'

test('the FHIR adapter normalizes a bundle into one encounter per Encounter resource', () => {
  const encounters = ingestFhirBundle(mockEhrDay('2026-06-19'))
  assert.equal(encounters.length, 15)
})

test('FHIR → canonical maps payer, subscriber, provider, and dotless diagnoses', () => {
  const enc = ingestFhirBundle(mockEhrDay('2026-06-19')).find((e) => e.patientControlNumber === 'pt01')
  assert.ok(enc)
  assert.equal(enc.payer.externalId, '00123')
  assert.equal(enc.payer.name, 'Medicare (Novitas JH)')
  assert.equal(enc.claimFilingCode, 'MB')
  assert.equal(enc.subscriber.memberId, '1EG4TE5MK73')
  assert.equal(enc.subscriber.firstName, 'Eleanor')
  assert.equal(enc.subscriber.lastName, 'Whitfield')
  assert.equal(enc.subscriber.gender, 'F')
  assert.equal(enc.billingProvider.npi, '1326543210')
  assert.equal(enc.billingProvider.taxId, '731234567')
  assert.equal(enc.renderingProvider?.npi, '1234567893')
  assert.equal(enc.dateOfService, '2026-06-19')
  assert.equal(enc.placeOfServiceCode, '11')
  // Only the encounter-linked visit diagnoses, dot stripped — NOT the problem list (E78.5).
  assert.deepEqual(enc.diagnoses, ['E1165', 'I10'])
})

test('ChargeItems become service lines with cents + resolved diagnosis pointers', () => {
  const enc = ingestFhirBundle(mockEhrDay()).find((e) => e.patientControlNumber === 'pt01')!
  assert.equal(enc.lines.length, 2)
  const office = enc.lines[0]
  assert.equal(office.cptHcpcs, '99214')
  assert.equal(office.chargeCents, 17500) // $175.00 → integer cents
  assert.deepEqual(office.diagnosisPointers, [1, 2]) // supports E11.65 + I10
  const draw = enc.lines[1]
  assert.equal(draw.cptHcpcs, '36415')
  assert.deepEqual(draw.diagnosisPointers, [1]) // supports E11.65 only
})

test('the mapped encounter flows through encounterToClaim into a canonical claim', () => {
  const enc = ingestFhirBundle(mockEhrDay()).find((e) => e.patientControlNumber === 'pt04')!
  const claim = encounterToClaim(enc, 'fhir')
  assert.equal(claim.controlNumber, 'pt04')
  assert.equal(claim.sourceAdapter, 'fhir')
  assert.equal(claim.totalBilledCents, 25000) // 99214 ($175) + 93000 ($75)
  assert.equal(claim.lines.length, 2)
  assert.ok(claim.subscriber && claim.billingProvider)
})
