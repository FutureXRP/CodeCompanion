import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildArAging, ageInDays, bucketForAge, buildDenialAnalytics, sampleArBook } from '../lib/analytics'
import type { DenialRecord, Receivable } from '../lib/analytics'

const asOf = new Date('2026-06-19T00:00:00Z')
const dos = (days: number) => new Date(asOf.getTime() - days * 86_400_000).toISOString().slice(0, 10)

test('ageInDays + bucketForAge', () => {
  assert.equal(ageInDays(dos(45), asOf), 45)
  assert.equal(ageInDays(dos(-5), asOf), 0) // a future service date clamps to 0
  assert.equal(bucketForAge(0).key, '0-30')
  assert.equal(bucketForAge(30).key, '0-30')
  assert.equal(bucketForAge(31).key, '31-60')
  assert.equal(bucketForAge(91).key, '91-120')
  assert.equal(bucketForAge(200).key, '120+')
})

test('buildArAging: buckets, totals, over-90, DAR', () => {
  const recv: Receivable[] = [
    { claimControlNumber: 'a', payerName: 'Medicare', payerExternalId: '04312', dateOfService: dos(10), insuranceArCents: 10000, patientArCents: 0 },
    { claimControlNumber: 'b', payerName: 'Medicare', payerExternalId: '04312', dateOfService: dos(100), insuranceArCents: 0, patientArCents: 5000 },
    { claimControlNumber: 'c', payerName: 'Aetna', payerExternalId: '60054', dateOfService: dos(40), insuranceArCents: 3000, patientArCents: 2000 },
    { claimControlNumber: 'z', payerName: 'Aetna', payerExternalId: '60054', dateOfService: dos(5), insuranceArCents: 0, patientArCents: 0 }, // zero — ignored
  ]
  const r = buildArAging(recv, { asOf, avgDailyChargeCents: 1000 })
  assert.equal(r.totals.totalCents, 20000)
  assert.equal(r.totals.insuranceArCents, 13000)
  assert.equal(r.totals.patientArCents, 7000)
  assert.equal(r.totals.over90Cents, 5000) // only the 100-day receivable
  assert.equal(r.totals.count, 3) // zero-balance row excluded
  assert.equal(r.darDays, 20) // 20000 / 1000

  const byKey = Object.fromEntries(r.buckets.map((b) => [b.key, b]))
  assert.equal(byKey['0-30'].totalCents, 10000)
  assert.equal(byKey['31-60'].totalCents, 5000)
  assert.equal(byKey['91-120'].totalCents, 5000)
  const sumPct = r.buckets.reduce((s, b) => s + b.pctOfTotal, 0)
  assert.ok(Math.abs(sumPct - 1) < 1e-9)
  assert.equal(r.byPayer[0].payerExternalId, '04312') // 15000 > 5000, sorted desc
})

test('buildDenialAnalytics: rollup, appealable, rate, sort', () => {
  const den: DenialRecord[] = [
    { claimControlNumber: '1', payerName: 'Medicare', payerExternalId: '04312', dateOfService: dos(10), carcCode: '197', deniedCents: 10000 },
    { claimControlNumber: '2', payerName: 'Aetna', payerExternalId: '60054', dateOfService: dos(20), carcCode: '96', deniedCents: 8000 },
    { claimControlNumber: '3', payerName: 'Medicare', payerExternalId: '04312', dateOfService: dos(30), carcCode: '197', deniedCents: 5000 },
  ]
  const d = buildDenialAnalytics(den, 100)
  assert.equal(d.totalDeniedCents, 23000)
  assert.equal(d.appealableCents, 15000) // both 197s; 96 is non-appealable
  assert.equal(d.appealableCount, 2)
  assert.equal(d.deniedClaimCount, 3)
  assert.equal(d.denialRate, 0.03)

  assert.equal(d.byCarc[0].carcCode, '197') // 15000 denied, sorted first
  assert.equal(d.byCarc[0].appealable, true)
  assert.equal(d.byCarc[1].carcCode, '96')
  assert.equal(d.byCarc[1].appealable, false)
  assert.equal(d.byCarc[1].appealableCents, 0)
})

test('sampleArBook is deterministic and non-empty', () => {
  const sum = (xs: { insuranceArCents: number; patientArCents: number }[]) => xs.reduce((s, r) => s + r.insuranceArCents + r.patientArCents, 0)
  const a = sampleArBook(asOf)
  const b = sampleArBook(asOf)
  assert.equal(a.receivables.length, b.receivables.length)
  assert.equal(sum(a.receivables), sum(b.receivables))
  assert.equal(a.denials.length, b.denials.length)
  assert.ok(a.receivables.length > 0 && a.denials.length > 0)
})
