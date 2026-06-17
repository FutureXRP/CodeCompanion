import { test } from 'node:test'
import assert from 'node:assert/strict'

import { dollarsToCents, formatCents } from '../lib/canonical'
import type { Claim, Remittance } from '../lib/canonical'
import { loadSampleClaims, loadSampleRemittances } from '../lib/adapters/edi'
import { runDiff, classifyCarc, type RateLookup } from '../lib/diff'
import { runFoundMoney } from '../lib/found-money/run'
import { findingsToCsv } from '../lib/found-money/export'

const FIXED_NOW = new Date('2026-06-17T00:00:00Z')

test('money: decimal dollars convert to integer cents without float drift', () => {
  assert.equal(dollarsToCents('108.5'), 10850)
  assert.equal(dollarsToCents('245.5'), 24550)
  assert.equal(dollarsToCents('175'), 17500)
  assert.equal(dollarsToCents(''), 0)
  assert.equal(formatCents(12050), '$120.50')
  assert.equal(formatCents(160000), '$1,600.00')
  assert.equal(formatCents(-650), '-$6.50')
})

test('CARC classification: appealable vs terminal vs contractual', () => {
  assert.equal(classifyCarc('197').appealable, true)
  assert.equal(classifyCarc('197').category, 'denial')
  assert.equal(classifyCarc('45').category, 'contractual')
  assert.equal(classifyCarc('45').appealable, false)
  assert.equal(classifyCarc('29').appealable, false) // timely filing expired
  assert.equal(classifyCarc('999').appealable, true) // unknown -> surface for review
})

test('837 parser maps the sample into canonical claims', () => {
  const claims = loadSampleClaims()
  assert.equal(claims.length, 4)
  const c1 = claims.find((c) => c.controlNumber === 'PATIENT001')
  assert.ok(c1)
  assert.equal(c1.lines.length, 2)
  assert.equal(c1.lines[0].cptHcpcs, '99214')
  assert.equal(c1.lines[0].billedCents, 15000)
  assert.equal(c1.payer.externalId, '00123')
  const c3 = claims.find((c) => c.controlNumber === 'PATIENT003')
  assert.equal(c3?.diagnoses.length, 4)
})

test('835 parser maps the sample into canonical remittances', () => {
  const remits = loadSampleRemittances()
  assert.equal(remits.length, 3)
  const denied = remits.find((r) => r.claimControlNumber === 'PATIENT002')
  assert.ok(denied)
  assert.equal(denied.lines[0].paidCents, 0)
  assert.ok(denied.lines[0].adjustments.some((a) => a.groupCode === 'CO' && a.carcCode === '197'))
})

test('full pipeline totals are exactly $287.50', () => {
  const report = runFoundMoney()
  assert.equal(report.totals.recoverableCents, 28750)
  assert.equal(report.totals.count, 7)
  assert.equal(report.totals.byType.denial.recoverableCents, 16000)
  assert.equal(report.totals.byType.undercoding.recoverableCents, 2000)
  assert.equal(report.totals.byType.underpayment.recoverableCents, 1250)
  // PATIENT004: 837 sent, no 835 — contracted 99213 ($95) at timely-filing risk
  assert.equal(report.totals.byType.unadjudicated.recoverableCents, 9500)
  assert.equal(report.totals.byType.unadjudicated.count, 1)
  assert.equal(report.totals.appealableDenialCount, 1)
  // ranked by recoverable dollars — the $160 denial still leads
  assert.equal(report.findings[0].recoverableCents, 16000)
})

const rates: RateLookup = {
  rate: (_payer, cpt) => ({ '99214': 11500 } as Record<string, number>)[cpt],
}

function lineClaim(cpt: string, billed: number): Claim {
  return {
    controlNumber: 'C1',
    payer: { externalId: 'P', name: 'Test Payer' },
    diagnoses: ['E1165'],
    totalBilledCents: billed,
    sourceAdapter: 'edi',
    lines: [{ id: 'C1:1', lineNumber: 1, cptHcpcs: cpt, modifiers: [], units: 1, diagnosisPointers: [1], billedCents: billed }],
  }
}

test('patient responsibility is NOT counted as a payer underpayment', () => {
  const claim = lineClaim('99214', 15000)
  const remit: Remittance = {
    claimControlNumber: 'C1',
    payerClaimControlNumber: 'X',
    payer: { externalId: 'P', name: 'Test Payer' },
    claimStatusCode: '1',
    totalBilledCents: 15000,
    totalPaidCents: 9500,
    patientRespCents: 2000,
    lines: [{ cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 9500, allowedCents: 11500, patientRespCents: 2000, adjustments: [{ groupCode: 'PR', carcCode: '2', amountCents: 2000 }] }],
  }
  // contracted 11500, paid 9500, patient owes 2000 -> shortfall 0 -> no finding
  const findings = runDiff([claim], [remit], rates, FIXED_NOW)
  assert.equal(findings.length, 0)
})

test('partial patient responsibility still recovers the net payer shortfall', () => {
  const claim = lineClaim('99214', 15000)
  const remit: Remittance = {
    claimControlNumber: 'C1',
    payerClaimControlNumber: 'X',
    payer: { externalId: 'P', name: 'Test Payer' },
    claimStatusCode: '1',
    totalBilledCents: 15000,
    totalPaidCents: 9000,
    patientRespCents: 1000,
    lines: [{ cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 9000, allowedCents: 11500, patientRespCents: 1000, adjustments: [{ groupCode: 'PR', carcCode: '2', amountCents: 1000 }] }],
  }
  const findings = runDiff([claim], [remit], rates, FIXED_NOW)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].type, 'underpayment')
  assert.equal(findings[0].recoverableCents, 1500) // 11500 - 9000 - 1000
})

test('an unmet-deductible zero-pay line is patient-owed, not an appealable denial', () => {
  const claim = lineClaim('99214', 15000)
  const remit: Remittance = {
    claimControlNumber: 'C1',
    payerClaimControlNumber: 'X',
    payer: { externalId: 'P', name: 'Test Payer' },
    claimStatusCode: '1',
    totalBilledCents: 15000,
    totalPaidCents: 0,
    patientRespCents: 11500,
    lines: [{ cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 0, allowedCents: 11500, patientRespCents: 11500, adjustments: [{ groupCode: 'PR', carcCode: '1', amountCents: 11500 }] }],
  }
  const findings = runDiff([claim], [remit], rates, FIXED_NOW)
  assert.equal(findings.filter((f) => f.type === 'denial').length, 0)
  assert.equal(findings.length, 0)
})

test('a submitted claim with no remittance surfaces as unadjudicated (timely-filing risk)', () => {
  const claim = { ...lineClaim('99214', 15000), controlNumber: 'C9', dateOfService: '2025-01-01' }
  const findings = runDiff([claim], [], rates, FIXED_NOW) // no 835 at all
  assert.equal(findings.length, 1)
  assert.equal(findings[0].type, 'unadjudicated')
  assert.equal(findings[0].appealable, false)
  assert.equal(findings[0].recoverableCents, 11500) // contracted 99214, not the $150 billed
  assert.match(findings[0].reason, /no remittance/i)
})

test('a line the payer dropped is unadjudicated even when the rest of the claim paid', () => {
  const claim: Claim = {
    controlNumber: 'C2',
    payer: { externalId: 'P', name: 'Test Payer' },
    diagnoses: ['E1165'],
    dateOfService: '2026-03-01',
    totalBilledCents: 19000,
    sourceAdapter: 'edi',
    lines: [
      { id: 'C2:1', lineNumber: 1, cptHcpcs: '99214', modifiers: [], units: 1, diagnosisPointers: [1], billedCents: 15000 },
      { id: 'C2:2', lineNumber: 2, cptHcpcs: '93000', modifiers: [], units: 1, diagnosisPointers: [1], billedCents: 4000 },
    ],
  }
  const remit: Remittance = {
    claimControlNumber: 'C2', payerClaimControlNumber: 'X', payer: { externalId: 'P', name: 'Test Payer' },
    claimStatusCode: '1', totalBilledCents: 19000, totalPaidCents: 11500, patientRespCents: 0,
    lines: [{ cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 11500, allowedCents: 11500, patientRespCents: 0, adjustments: [{ groupCode: 'CO', carcCode: '45', amountCents: 3500 }] }],
  }
  const findings = runDiff([claim], [remit], rates, FIXED_NOW)
  const unadj = findings.filter((f) => f.type === 'unadjudicated')
  assert.equal(unadj.length, 1)
  assert.equal(unadj[0].cptHcpcs, '93000')
  assert.equal(unadj[0].recoverableCents, 4000) // no contracted rate for 93000 -> billed
})

test('CSV export has a header plus one row per finding', () => {
  const report = runFoundMoney()
  const csv = findingsToCsv(report.findings)
  const lines = csv.trim().split('\n')
  assert.equal(lines.length, report.findings.length + 1)
  assert.ok(lines[0].startsWith('recoverable,type,cpt'))
  assert.ok(csv.includes('99215'))
})
