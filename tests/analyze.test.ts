import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { analyze } from '../lib/analyze/run'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const s837 = read('lib/adapters/edi/samples/claim_837_sample.edi')
const s835 = read('lib/adapters/edi/samples/remit_835_sample.edi')
const csv = read('lib/adapters/fee-schedule/sample_fee_schedule.csv')

test('analyze on the sample data reproduces the $287.50 worklist', () => {
  const r = analyze(s837, s835, csv)
  assert.equal(r.foundMoney.totals.recoverableCents, 28750)
  assert.equal(r.foundMoney.meta.source, 'upload')
})

test('analyze derives the claim lifecycle from the actual 835', () => {
  const r = analyze(s837, s835, csv)
  assert.equal(r.claimTotals.total, 4)
  assert.equal(r.claimTotals.paid, 2)
  assert.equal(r.claimTotals.denied, 1)
  assert.equal(r.claimTotals.submitted, 1) // PATIENT004 — 837 sent, no 835 back
  const denied = r.claims.find((c) => c.claimControlNumber === 'PATIENT002')
  assert.equal(denied?.status, 'denied')
  const paid = r.claims.find((c) => c.claimControlNumber === 'PATIENT001')
  assert.equal(paid?.status, 'paid')
})
