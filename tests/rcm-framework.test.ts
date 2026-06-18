import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { loadSampleClaims, generate837 } from '../lib/adapters/edi'
import { PayerDirectory, ingestPayerListCsv } from '../lib/rcm/payer-directory'
import { EnrollmentRegistry, type EnrollmentRecord } from '../lib/rcm/enrollment'
import { createClearinghouse, MockClearinghouse } from '../lib/rcm/clearinghouse'

const payerCsv = readFileSync(join(process.cwd(), 'lib/rcm/samples/payer_list_sample.csv'), 'utf8')
const rates = { rate: () => undefined }

test('payer directory: ingest a clearinghouse payer list and resolve routing ids', () => {
  const dir = new PayerDirectory(ingestPayerListCsv(payerCsv, 'stedi'))
  assert.equal(dir.resolve('00123', 'stedi'), 'MCTX01')
  assert.equal(dir.resolve('00456', 'stedi'), '60054')
  // exists in the directory, but no id mapped for a different clearinghouse
  assert.equal(dir.resolve('00123', 'availity'), undefined)
  assert.ok(dir.size >= 3)
})

test('payer directory: the same payer carries different ids per clearinghouse', () => {
  const dir = new PayerDirectory()
  dir.add({ payerExternalId: '00123', name: 'Medicare TX', clearinghouseIds: { stedi: 'MCTX01' } })
  dir.add({ payerExternalId: '00123', name: 'Medicare TX', clearinghouseIds: { availity: '01192' } })
  assert.equal(dir.resolve('00123', 'stedi'), 'MCTX01')
  assert.equal(dir.resolve('00123', 'availity'), '01192')
  assert.equal(dir.size, 1) // merged, not duplicated
})

test('payer directory: unmapped() flags payers not routable through a clearinghouse', () => {
  const dir = new PayerDirectory(ingestPayerListCsv(payerCsv, 'stedi'))
  assert.equal(dir.unmapped('availity').length, dir.size) // none mapped to availity
  assert.equal(dir.unmapped('stedi').length, 0)
})

test('enrollment: submission is gated until a payer enrollment is approved', () => {
  // unknown payer -> fail safe (never assume a payer is live)
  assert.equal(new EnrollmentRegistry().canSubmit('1234567893', '00123', 'stedi', 'claim').ok, false)

  const records: EnrollmentRecord[] = [
    { providerNpi: '1234567893', payerExternalId: '00123', clearinghouse: 'stedi', transaction: 'claim', state: 'approved', effectiveDate: '2026-01-01' },
    { providerNpi: '1234567893', payerExternalId: '00123', clearinghouse: 'stedi', transaction: 'era', state: 'pending' },
    { providerNpi: '1234567893', payerExternalId: '00456', clearinghouse: 'stedi', transaction: 'claim', state: 'not_required' },
  ]
  const reg = new EnrollmentRegistry(records)
  assert.equal(reg.canSubmit('1234567893', '00123', 'stedi', 'claim').ok, true)
  assert.equal(reg.canSubmit('1234567893', '00123', 'stedi', 'era').ok, false) // pending, not live
  assert.equal(reg.canSubmit('1234567893', '00456', 'stedi', 'claim').ok, true) // no enrollment required
})

test('clearinghouse factory: mock works; real providers are gated by the compliance gate', () => {
  const mock = createClearinghouse({ provider: 'mock', rates })
  assert.ok(mock instanceof MockClearinghouse)

  // real provider without the gate -> refuses to move PHI
  assert.throws(() => createClearinghouse({ provider: 'stedi', rates }), /COMPLIANCE/)
  // gate open, but the adapter itself isn't built yet
  assert.throws(() => createClearinghouse({ provider: 'stedi', rates, allowRealPhi: true }), /not implemented/)
})

test('mock clearinghouse reports claim status (276/277-equivalent)', () => {
  const ch = new MockClearinghouse(rates)
  ch.submit(generate837(loadSampleClaims()))
  assert.equal(ch.checkStatus(['PATIENT001'])[0].category, 'finalized')
  assert.equal(ch.checkStatus(['NOPE'])[0].category, 'unknown')
})
