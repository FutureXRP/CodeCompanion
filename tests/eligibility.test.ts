import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MockEligibilityService,
  deriveEligibilitySummary,
  type BenefitItem,
  type EligibilityRequest,
} from '../lib/rcm/eligibility'
import {
  StediEligibilityService,
  canonicalToStedi270,
  mapEligibilityResponse,
  buildStediTestEligibility,
} from '../lib/rcm/stedi-eligibility'
import { PayerDirectory } from '../lib/rcm/payer-directory'
import type { HttpRequest, HttpResponse, HttpTransport } from '../lib/rcm/stedi-http'

const REQ: EligibilityRequest = {
  payer: { externalId: 'STEDITEST', name: 'Stedi Test Payer' },
  subscriber: { memberId: 'TEST123', firstName: 'JANE', lastName: 'DOE', dateOfBirth: '1990-01-01', gender: 'F' },
  provider: { npi: '1234567893', organizationName: 'CODECOMPANION TEST CLINIC' },
}

/** A representative 271 body: active, with in- and out-of-network variants. */
const SAMPLE_271 = {
  controlNumber: '123456789',
  subscriber: { memberId: 'TEST123', firstName: 'JANE', lastName: 'DOE' },
  payer: { name: 'AETNA' },
  planInformation: { groupDescription: 'GOLD PPO' },
  benefitsInformation: [
    { code: '1', name: 'Active Coverage', serviceTypeCodes: ['30'], serviceTypes: ['Health Benefit Plan Coverage'] },
    { code: 'B', name: 'Co-Payment', serviceTypeCodes: ['98'], benefitAmount: '50', inPlanNetworkIndicatorCode: 'N' },
    { code: 'B', name: 'Co-Payment', serviceTypeCodes: ['98'], benefitAmount: '25', inPlanNetworkIndicatorCode: 'Y' },
    { code: 'A', name: 'Co-Insurance', serviceTypeCodes: ['30'], benefitPercent: '0.4', inPlanNetworkIndicatorCode: 'N' },
    { code: 'A', name: 'Co-Insurance', serviceTypeCodes: ['30'], benefitPercent: '0.2', inPlanNetworkIndicatorCode: 'Y' },
    { code: 'C', name: 'Deductible', serviceTypeCodes: ['30'], benefitAmount: '1500', timeQualifierCode: '23', inPlanNetworkIndicatorCode: 'Y' },
    { code: 'C', name: 'Deductible', serviceTypeCodes: ['30'], benefitAmount: '500', timeQualifierCode: '29', inPlanNetworkIndicatorCode: 'Y' },
    { code: 'G', name: 'Out of Pocket', serviceTypeCodes: ['30'], benefitAmount: '5000', timeQualifierCode: '23', inPlanNetworkIndicatorCode: 'Y' },
    { code: 'G', name: 'Out of Pocket', serviceTypeCodes: ['30'], benefitAmount: '3000', timeQualifierCode: '29', inPlanNetworkIndicatorCode: 'Y' },
  ],
}

function transportReturning(response: HttpResponse, sink?: HttpRequest[]): HttpTransport {
  return async (req) => {
    sink?.push(req)
    return response
  }
}

test('mapEligibilityResponse: parses 271 into active coverage with in-network financials', () => {
  const r = mapEligibilityResponse({ status: 200, json: SAMPLE_271 }, REQ)
  assert.equal(r.status, 'active')
  assert.equal(r.active, true)
  assert.equal(r.planName, 'GOLD PPO')
  assert.equal(r.payer.name, 'AETNA') // payer name from the 271 wins
  assert.equal(r.copayCents, 2500) // in-network ($25) preferred over OON ($50)
  assert.equal(r.coinsurancePercent, 0.2) // in-network 20%, not OON 40%
  assert.equal(r.deductibleCents, 150000) // total (time qualifier 23)
  assert.equal(r.deductibleRemainingCents, 50000) // remaining (time qualifier 29)
  assert.equal(r.outOfPocketCents, 500000)
  assert.equal(r.outOfPocketRemainingCents, 300000)
  assert.equal(r.benefits.length, 9) // every EB preserved
  assert.equal(r.errors.length, 0)
})

test('mapEligibilityResponse: inactive coverage', () => {
  const r = mapEligibilityResponse(
    { status: 200, json: { benefitsInformation: [{ code: '6', name: 'Inactive', serviceTypeCodes: ['30'] }] } },
    REQ,
  )
  assert.equal(r.status, 'inactive')
  assert.equal(r.active, false)
})

test('mapEligibilityResponse: HTTP error surfaces payer errors and unknown status', () => {
  const r = mapEligibilityResponse({ status: 404, json: { errors: [{ description: 'Payer not found' }] } }, REQ)
  assert.equal(r.status, 'unknown')
  assert.equal(r.active, false)
  assert.match(r.errors.join(' '), /Payer not found/)
  // member echoes back from the request when the payer returns nothing usable
  assert.equal(r.member.memberId, 'TEST123')
})

test('mapEligibilityResponse: tolerates string-form errors and empty body', () => {
  const r = mapEligibilityResponse({ status: 500, json: { errors: ['boom'] } }, REQ)
  assert.match(r.errors.join(' '), /boom/)
  const empty = mapEligibilityResponse({ status: 200, json: null }, REQ)
  assert.equal(empty.status, 'unknown')
})

test('canonicalToStedi270: builds the documented 270 shape', () => {
  const payload = canonicalToStedi270(REQ, { tradingPartnerServiceId: 'AETNA', controlNumber: '000000001' }) as Record<string, any>
  assert.equal(payload.controlNumber, '000000001')
  assert.equal(payload.usageIndicator, undefined) // eligibility must NOT send usageIndicator (claims-API field only)
  assert.equal(payload.tradingPartnerServiceId, 'AETNA')
  assert.equal(payload.provider.npi, '1234567893')
  assert.equal(payload.provider.organizationName, 'CODECOMPANION TEST CLINIC')
  assert.equal(payload.subscriber.dateOfBirth, '19900101') // dashes stripped
  assert.equal(payload.subscriber.gender, 'F')
  assert.deepEqual(payload.encounter.serviceTypeCodes, ['30'])
})

test('canonicalToStedi270: defaults service type to general coverage (30)', () => {
  const payload = canonicalToStedi270(
    { payer: REQ.payer, subscriber: REQ.subscriber, provider: { npi: '1', firstName: 'A', lastName: 'B' } },
    { tradingPartnerServiceId: 'X' },
  ) as Record<string, any>
  assert.deepEqual(payload.encounter.serviceTypeCodes, ['30'])
  assert.equal(payload.provider.firstName, 'A') // individual-provider shape when no org
})

test('StediEligibilityService.check: posts to eligibility/v3, sandbox auth, resolves payer id', async () => {
  const reqs: HttpRequest[] = []
  const directory = new PayerDirectory([
    { payerExternalId: 'AETNA', name: 'Aetna', clearinghouseIds: { stedi: '60054' } },
  ])
  const svc = new StediEligibilityService({
    apiKey: 'test-key',
    sandbox: true,
    payerDirectory: directory,
    transport: transportReturning({ status: 200, json: SAMPLE_271 }, reqs),
  })

  const result = await svc.check({ ...REQ, payer: { externalId: 'AETNA', name: 'Aetna' } })
  assert.equal(result.active, true)
  assert.equal(result.copayCents, 2500)

  const sent = reqs[0]
  assert.equal(sent.method, 'POST')
  assert.ok(sent.url.endsWith('/eligibility/v3'))
  assert.equal(sent.headers.Authorization, 'test-key')
  const body = JSON.parse(sent.body ?? '{}')
  assert.equal(body.usageIndicator, undefined) // Stedi eligibility rejects usageIndicator — must not send it
  assert.equal(body.tradingPartnerServiceId, '60054') // resolved via the payer directory
})

test('StediEligibilityService.check: falls back to the canonical payer id when unmapped', async () => {
  const reqs: HttpRequest[] = []
  const svc = new StediEligibilityService({
    apiKey: 'k',
    sandbox: true,
    transport: transportReturning({ status: 200, json: SAMPLE_271 }, reqs),
  })
  await svc.check(REQ)
  const body = JSON.parse(reqs[0].body ?? '{}')
  assert.equal(body.tradingPartnerServiceId, 'STEDITEST')
})

test('deriveEligibilitySummary: prefers in-network and distinguishes remaining', () => {
  const benefits: BenefitItem[] = [
    { code: '1', name: 'Active', serviceTypeCodes: ['30'], serviceTypes: [], network: 'unknown', messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: ['30'], serviceTypes: [], network: 'out_of_network', amountCents: 999900, timeQualifierCode: '23', messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: ['30'], serviceTypes: [], network: 'in_network', amountCents: 200000, timeQualifierCode: '23', messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: ['30'], serviceTypes: [], network: 'in_network', amountCents: 75000, timeQualifierCode: '29', messages: [] },
  ]
  const s = deriveEligibilitySummary(benefits)
  assert.equal(s.status, 'active')
  assert.equal(s.deductibleCents, 200000) // in-network total, not the OON 9999.00
  assert.equal(s.deductibleRemainingCents, 75000)
})

test('MockEligibilityService: active member returns representative benefits', async () => {
  const r = await new MockEligibilityService().check(REQ)
  assert.equal(r.active, true)
  assert.equal(r.copayCents, 2500)
  assert.equal(r.coinsurancePercent, 0.2)
  assert.equal(r.deductibleRemainingCents, 50000)
  assert.ok(r.benefits.length > 1)
})

test('MockEligibilityService: an "inactive" member id returns terminated coverage', async () => {
  const r = await new MockEligibilityService().check({
    ...REQ,
    subscriber: { ...REQ.subscriber, memberId: 'INACTIVE-9' },
  })
  assert.equal(r.status, 'inactive')
  assert.equal(r.active, false)
})

test('buildStediTestEligibility: Stedi documented mock member (returns active coverage)', () => {
  const req = buildStediTestEligibility()
  assert.equal(req.payer.externalId, 'STEDI')
  assert.equal(req.subscriber.memberId, '23051322')
  assert.equal(req.subscriber.firstName, 'Bernie')
  assert.equal(req.provider.npi, '1447848577')
  assert.equal(req.stediTest, true)
  assert.deepEqual(req.serviceTypeCodes, ['30'])
})

test('canonicalToStedi270: includes the stediTest flag only for a mock request', () => {
  const off = canonicalToStedi270(REQ, { tradingPartnerServiceId: 'STEDI' }) as Record<string, any>
  assert.equal(off.stediTest, undefined)
  const on = canonicalToStedi270({ ...REQ, stediTest: true }, { tradingPartnerServiceId: 'STEDI' }) as Record<string, any>
  assert.equal(on.stediTest, true)
})
