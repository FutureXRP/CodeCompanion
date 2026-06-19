import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildCommandCenter } from '../lib/rcm/command-center'

test('command center: rolls the synthetic day into internally consistent KPIs', () => {
  const cc = buildCommandCenter()
  assert.ok(cc.counts.patients > 0)
  assert.equal(cc.counts.claims, cc.counts.patients)
  // Capture opportunity is exactly recoverable leakage + patient A/R.
  assert.equal(cc.kpis.captureOpportunityCents, cc.kpis.recoverableCents + cc.kpis.patientArCents)
  // You can't collect more than you billed; rates are bounded.
  assert.ok(cc.kpis.collectedCents <= cc.kpis.billedCents)
  assert.ok(cc.kpis.cleanClaimRate >= 0 && cc.kpis.cleanClaimRate <= 1)
})

test('command center: stages span the whole revenue cycle', () => {
  const keys = buildCommandCenter().stages.map((s) => s.key)
  for (const k of ['eligibility', 'charges', 'scrub', 'submit', 'denials', 'found', 'balances', 'collected']) {
    assert.ok(keys.includes(k), `missing stage ${k}`)
  }
})

test('command center: worklist is ranked by recoverable dollars and name-enriched', () => {
  const cc = buildCommandCenter(20)
  for (let i = 1; i < cc.worklist.length; i++) {
    assert.ok(cc.worklist[i - 1].recoverableCents >= cc.worklist[i].recoverableCents)
  }
  // The synthetic day has at least one actionable item (a prior-auth denial).
  assert.ok(cc.worklist.length >= 1)
  assert.ok(cc.worklist[0].patientName && cc.worklist[0].patientName.length > 0)
})

test('command center: balances are patient-owed accounts within the limit', () => {
  const cc = buildCommandCenter(6, 4)
  assert.ok(cc.balances.length <= 4)
  for (const b of cc.balances) assert.ok(b.patientArCents > 0)
})
