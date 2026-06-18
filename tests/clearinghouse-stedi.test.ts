import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { loadSampleClaims, generate837 } from '../lib/adapters/edi'
import {
  StediClearinghouse,
  mapSubmissionResponse,
  mapClaimStatusResponse,
  mapStatusCategory,
  type HttpTransport,
  type HttpRequest,
  type HttpResponse,
} from '../lib/rcm/stedi-clearinghouse'

const edi837 = generate837(loadSampleClaims())

/** Stubbed transport: captures requests, returns a scripted response. */
function transportReturning(response: HttpResponse, sink?: HttpRequest[]): HttpTransport {
  return async (req) => {
    sink?.push(req)
    return response
  }
}

test('stedi submit: posts raw X12 with sandbox usageIndicator and Key auth', async () => {
  const reqs: HttpRequest[] = []
  const ch = new StediClearinghouse({
    apiKey: 'test-key',
    sandbox: true,
    transport: transportReturning({ status: 200, json: { transactionId: 'TX-1' } }, reqs),
  })

  const acks = await ch.submit(edi837)
  assert.equal(acks.length, loadSampleClaims().length)
  assert.ok(acks.every((a) => a.status === 'accepted' && a.payerClaimControlNumber === 'TX-1'))

  const req = reqs[0]
  assert.equal(req.method, 'POST')
  assert.equal(req.headers.Authorization, 'Key test-key')
  const body = JSON.parse(req.body ?? '{}')
  assert.equal(body.usageIndicator, 'T') // sandbox never defaults to production
  assert.ok(body.rawX12.includes('ST*837'))
})

test('stedi submit: per-claim references map accepted vs rejected', () => {
  const res: HttpResponse = {
    status: 200,
    json: {
      claimReferences: [
        { patientControlNumber: 'PATIENT001', stediId: 'S1' },
        { patientControlNumber: 'PATIENT002', status: 'rejected', errors: [{ message: 'Missing subscriber id' }] },
      ],
    },
  }
  const acks = mapSubmissionResponse(res, ['PATIENT001', 'PATIENT002'])
  const byCn = Object.fromEntries(acks.map((a) => [a.claimControlNumber, a]))
  assert.equal(byCn['PATIENT001'].status, 'accepted')
  assert.equal(byCn['PATIENT001'].payerClaimControlNumber, 'S1')
  assert.equal(byCn['PATIENT002'].status, 'rejected')
  assert.match(byCn['PATIENT002'].rejectReason ?? '', /Missing subscriber id/)
})

test('stedi submit: an HTTP error rejects every submitted claim', () => {
  const acks = mapSubmissionResponse({ status: 422, json: { errors: [{ message: 'bad envelope' }] } }, ['A', 'B'])
  assert.equal(acks.length, 2)
  assert.ok(acks.every((a) => a.status === 'rejected'))
  assert.match(acks[0].rejectReason ?? '', /bad envelope/)
})

test('stedi status: 277 category codes map to our lifecycle categories', () => {
  assert.equal(mapStatusCategory('F1'), 'finalized')
  assert.equal(mapStatusCategory('A2'), 'accepted')
  assert.equal(mapStatusCategory('P3'), 'pending')
  assert.equal(mapStatusCategory('R5'), 'rejected')
  assert.equal(mapStatusCategory(''), 'unknown')

  const resp = mapClaimStatusResponse(
    { status: 200, json: { claimStatusCategoryCode: 'F1', statusDescription: 'Finalized/Paid' } },
    'C1',
  )
  assert.equal(resp.category, 'finalized')
  assert.equal(resp.claimControlNumber, 'C1')
})

test('stedi fetchRemittances: parses returned raw 835 ERAs with the existing parser', async () => {
  const sample835 = readFileSync(join(process.cwd(), 'lib/adapters/edi/samples/remit_835_sample.edi'), 'utf8')
  const ch = new StediClearinghouse({
    apiKey: 'k',
    sandbox: true,
    transport: transportReturning({ status: 200, json: { items: [{ rawX12: sample835 }] } }),
  })
  const remits = await ch.fetchRemittances()
  assert.equal(remits.length, 3) // sample 835 carries three claim remittances
})
