import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createAthenaSource,
  MockAthenaSource,
  AthenaClient,
  athenaBundleToEhrEncounter,
  athenaDate,
  sampleAthenaBundles,
  pullAthenaEncounters,
  type HttpRequest,
  type HttpResponse,
} from '../lib/adapters/athena'
import { encounterToClaim } from '../lib/adapters/ehr'

test('athenaDate normalizes MM/DD/YYYY to YYYY-MM-DD', () => {
  assert.equal(athenaDate('01/05/1990'), '1990-01-05')
  assert.equal(athenaDate('7/4/2026'), '2026-07-04')
  assert.equal(athenaDate('2026-01-15'), '2026-01-15')
  assert.equal(athenaDate(undefined), '')
})

test('athenaBundleToEhrEncounter maps a bundle into a canonical encounter + claim', () => {
  const e = athenaBundleToEhrEncounter(sampleAthenaBundles('2026-01-15')[0]) // Jane Doe / Medicare
  assert.equal(e.subscriber.memberId, '1EG4TE5MK72')
  assert.equal(e.subscriber.firstName, 'JANE')
  assert.equal(e.subscriber.dateOfBirth, '1990-01-01')
  assert.equal(e.subscriber.gender, 'F')
  assert.equal(e.subscriber.address?.postalCode, '74135')
  assert.equal(e.payer.externalId, '04312')
  assert.equal(e.payer.name, 'Medicare')
  assert.equal(e.billingProvider.npi, '1234567893')
  assert.equal(e.billingProvider.taxId, '742345678')
  assert.equal(e.claimFilingCode, 'MB')
  assert.deepEqual(e.diagnoses, ['E1165', 'I10'])
  assert.equal(e.lines.length, 2)
  assert.equal(e.lines[0].cptHcpcs, '99214')
  assert.equal(e.lines[0].chargeCents, 15000)
  assert.deepEqual(e.lines[0].diagnosisPointers, [1, 2])
  assert.equal(e.lines[1].cptHcpcs, '36415')
  assert.deepEqual(e.lines[1].diagnosisPointers, [1])

  const claim = encounterToClaim(e, 'athena')
  assert.equal(claim.totalBilledCents, 17500)
  assert.equal(claim.sourceAdapter, 'athena')
  assert.equal(claim.lines.length, 2)
})

test('MockAthenaSource + pullAthenaEncounters yields canonical encounters', async () => {
  const encs = await pullAthenaEncounters(new MockAthenaSource(), { serviceDateFrom: '2026-01-15' })
  assert.equal(encs.length, 3)
  assert.ok(encs.every((e) => e.lines.length > 0 && e.payer.externalId))
})

test('createAthenaSource defaults to mock and gates the real client', () => {
  assert.ok(createAthenaSource() instanceof MockAthenaSource)
  assert.throws(() => createAthenaSource({ useMock: false }), /gated by COMPLIANCE/)
  assert.throws(() => createAthenaSource({ useMock: false, allowRealPhi: true }), /requires ATHENA_CLIENT_ID/)
  const real = createAthenaSource({ useMock: false, allowRealPhi: true, clientId: 'c', clientSecret: 's', practiceId: '195900', transport: async () => ({ status: 200, json: {} }) })
  assert.ok(real instanceof AthenaClient)
})

test('AthenaClient: OAuth client-credentials token is requested correctly and cached', async () => {
  const reqs: HttpRequest[] = []
  const client = new AthenaClient({
    clientId: 'cid', clientSecret: 'secret', practiceId: '195900',
    transport: async (req) => { reqs.push(req); return req.url.endsWith('/oauth2/v1/token') ? { status: 200, json: { access_token: 'tok-1', expires_in: 3600 } } : { status: 200, json: {} } },
  })
  assert.equal(await client.getToken(), 'tok-1')
  await client.getToken() // cached — no second token call
  const tokenCalls = reqs.filter((r) => r.url.endsWith('/oauth2/v1/token'))
  assert.equal(tokenCalls.length, 1)
  assert.equal(tokenCalls[0].method, 'POST')
  assert.match(tokenCalls[0].headers.Authorization, /^Basic /)
  assert.match(tokenCalls[0].body ?? '', /grant_type=client_credentials/)
})

test('AthenaClient.getEncounterBundles joins claims + patient + insurance + provider', async () => {
  const transport = async (req: HttpRequest): Promise<HttpResponse> => {
    const u = req.url
    if (u.includes('/oauth2/v1/token')) return { status: 200, json: { access_token: 't', expires_in: 3600 } }
    if (u.includes('/claims')) return { status: 200, json: { claims: [{ claimid: 'c1', encounterid: 'e1', patientid: 'P1', providerid: 'PR1', servicedate: '01/15/2026', placeofservice: '11', claimcategory: 'MB', charges: [{ procedurecode: '99214', unitcount: 1, amount: 150, icd10code: 'E1165' }] }] } }
    if (u.includes('/patients/P1/insurances')) return { status: 200, json: { insurances: [{ insurancepackageid: '04312', insuranceplanname: 'Medicare', insuranceidnumber: 'M123', insurancetype: 'MB', sequencenumber: '1' }] } }
    if (/\/patients\/P1$/.test(u)) return { status: 200, json: [{ patientid: 'P1', firstname: 'Jane', lastname: 'Doe', dob: '01/01/1990', sex: 'F' }] }
    if (u.includes('/providers/PR1')) return { status: 200, json: [{ providerid: 'PR1', npi: '1234567893', billingname: 'Clinic' }] }
    return { status: 404, json: {} }
  }
  const client = new AthenaClient({ clientId: 'c', clientSecret: 's', practiceId: '195900', transport })
  const bundles = await client.getEncounterBundles({ serviceDateFrom: '2026-01-15' })
  assert.equal(bundles.length, 1)
  assert.equal(bundles[0].patientControlNumber, 'P1')
  assert.equal(bundles[0].insurance.insuranceidnumber, 'M123')
  assert.equal(bundles[0].provider.npi, '1234567893')

  const e = athenaBundleToEhrEncounter(bundles[0])
  assert.equal(e.subscriber.memberId, 'M123')
  assert.equal(e.lines[0].cptHcpcs, '99214')
})

test('AthenaClient backs off on 429 throttling, then succeeds (ToS §1(b))', async () => {
  let claimCalls = 0
  const slept: number[] = []
  const client = new AthenaClient({
    clientId: 'c', clientSecret: 's', practiceId: '195900',
    sleep: async (ms) => { slept.push(ms) }, // no real wait in tests
    transport: async (req) => {
      if (req.url.endsWith('/oauth2/v1/token')) return { status: 200, json: { access_token: 't', expires_in: 3600 } }
      claimCalls++
      if (claimCalls < 3) return { status: 429, json: {} } // throttled twice, then OK
      return { status: 200, json: { claims: [] } }
    },
  })
  const bundles = await client.getEncounterBundles({ serviceDateFrom: '2026-01-15' })
  assert.equal(bundles.length, 0)
  assert.equal(claimCalls, 3) // two retries + success
  assert.deepEqual(slept, [500, 1000]) // exponential backoff
})
