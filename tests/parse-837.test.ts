import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSampleClaims } from '../lib/adapters/edi'

test('837 parser enriches claims with the subscriber loop (SBR / NM1*IL / DMG)', () => {
  const claims = loadSampleClaims()
  const c1 = claims.find((c) => c.controlNumber === 'PATIENT001')
  assert.ok(c1)
  assert.ok(c1.subscriber, 'subscriber should be populated')
  assert.equal(c1.subscriber.memberId, '1EG4TE5MK73')
  assert.equal(c1.subscriber.firstName, 'JOHN')
  assert.equal(c1.subscriber.lastName, 'DOE')
  assert.equal(c1.subscriber.dateOfBirth, '1950-01-01')
  assert.equal(c1.subscriber.gender, 'M')
  assert.equal(c1.subscriber.address?.line1, '456 OAK AVE')
  assert.equal(c1.subscriber.address?.city, 'AUSTIN')
  assert.equal(c1.subscriber.address?.state, 'TX')
  assert.equal(c1.subscriber.address?.postalCode, '78701')
  assert.equal(c1.claimFilingCode, 'MB')
})

test('subscriber enrichment leaves the diff-facing fields untouched', () => {
  const claims = loadSampleClaims()
  assert.equal(claims.length, 4)
  const c1 = claims.find((c) => c.controlNumber === 'PATIENT001')
  assert.equal(c1?.lines.length, 2)
  assert.equal(c1?.lines[0].cptHcpcs, '99214')
  assert.equal(c1?.lines[0].billedCents, 15000)
  assert.equal(c1?.payer.externalId, '00123')
  const c3 = claims.find((c) => c.controlNumber === 'PATIENT003')
  assert.equal(c3?.diagnoses.length, 4)
})
