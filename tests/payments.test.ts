import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MockPaymentProvider, createPaymentProvider, toPatientPayment } from '../lib/payments'

test('mock provider charges a positive amount and rejects a non-positive one', async () => {
  const p = new MockPaymentProvider()
  const ok = await p.charge({ accountKey: 'A', amountCents: 2500, method: 'card' })
  assert.equal(ok.ok, true)
  assert.equal(ok.provider, 'mock')
  assert.ok(ok.transactionId)

  const bad = await p.charge({ accountKey: 'A', amountCents: 0, method: 'card' })
  assert.equal(bad.ok, false)
  assert.ok(bad.error)
})

test('toPatientPayment bridges a charge into a ledger payment', async () => {
  const req = { accountKey: 'MEM1', amountCents: 3000, method: 'card' as const, patientName: 'Jane Doe' }
  const result = await new MockPaymentProvider().charge(req)
  const pp = toPatientPayment(req, result)
  assert.equal(pp.accountKey, 'MEM1')
  assert.equal(pp.amountCents, 3000)
  assert.equal(pp.method, 'card')
  assert.equal(pp.id, result.transactionId)
})

test('createPaymentProvider defaults to mock and gates Stripe', () => {
  const prev = process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_SECRET_KEY

  assert.ok(createPaymentProvider() instanceof MockPaymentProvider)
  assert.throws(() => createPaymentProvider({ provider: 'stripe' }), /not configured/)

  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  assert.throws(() => createPaymentProvider({ provider: 'stripe' }), /gated/)
  assert.throws(() => createPaymentProvider({ provider: 'stripe', allowRealCharges: true }), /not implemented/)

  if (prev === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = prev
})
