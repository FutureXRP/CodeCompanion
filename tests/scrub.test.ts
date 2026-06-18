import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim, ClaimLine } from '../lib/canonical'
import { scrubClaim, OKLAHOMA, getJurisdiction } from '../lib/scrub'
import { loadSampleClaims } from '../lib/adapters/edi'

function line(cpt: string, opts: { modifiers?: string[]; units?: number; pointers?: number[]; cents?: number } = {}): ClaimLine {
  return {
    id: `C:${cpt}`,
    lineNumber: 1,
    cptHcpcs: cpt,
    modifiers: opts.modifiers ?? [],
    units: opts.units ?? 1,
    diagnosisPointers: opts.pointers ?? [1],
    billedCents: opts.cents ?? 10000,
  }
}

function claim(lines: ClaimLine[], over: Partial<Claim> = {}): Claim {
  return {
    controlNumber: 'C',
    payer: { externalId: 'P', name: 'Test Payer' },
    providerNpi: '1234567893',
    diagnoses: ['E1165'],
    placeOfService: '11',
    claimFilingCode: 'MB',
    totalBilledCents: lines.reduce((s, l) => s + l.billedCents, 0),
    sourceAdapter: 'edi',
    lines,
    ...over,
  }
}

test('the sample E/M + procedure claim earns a modifier-25 warning but no errors', () => {
  const claims = loadSampleClaims()
  const p3 = scrubClaim(claims.find((c) => c.controlNumber === 'PATIENT003')!, OKLAHOMA)
  assert.equal(p3.ok, true)
  assert.ok(p3.findings.some((f) => f.code === 'CCI-25' && f.severity === 'warning'))
  // 99214 + 36415 (a draw, not a procedure) → no modifier-25 warning.
  const p1 = scrubClaim(claims.find((c) => c.controlNumber === 'PATIENT001')!, OKLAHOMA)
  assert.equal(p1.warningCount, 0)
})

test('required-field problems are errors that block the claim', () => {
  const r = scrubClaim(claim([{ ...line('99214'), cptHcpcs: '' }], { payer: { externalId: '', name: 'x' } }))
  assert.equal(r.ok, false)
  assert.ok(r.findings.some((f) => f.code === 'REQ-PAYER'))
  assert.ok(r.findings.some((f) => f.code === 'REQ-CPT'))
})

test('MUE cap exceeded is an error', () => {
  const r = scrubClaim(claim([line('99214', { units: 2 })]))
  assert.ok(r.findings.some((f) => f.code === 'MUE' && f.severity === 'error'))
  assert.equal(r.ok, false)
})

test('a non-bypassable CCI pair errors; a bypassable one warns unless a 59 modifier clears it', () => {
  const bundled = scrubClaim(claim([line('80053'), line('80048')]))
  assert.ok(bundled.findings.some((f) => f.code === 'CCI-PTP' && f.severity === 'error'))

  const warn = scrubClaim(claim([line('80053'), line('82565')]))
  assert.ok(warn.findings.some((f) => f.code === 'CCI-PTP' && f.severity === 'warning'))

  const cleared = scrubClaim(claim([line('80053'), line('82565', { modifiers: ['59'] })]))
  assert.ok(!cleared.findings.some((f) => f.code === 'CCI-PTP'))
})

test('a diagnosis pointer with no matching diagnosis is an error', () => {
  const r = scrubClaim(claim([line('99214', { pointers: [3] })])) // only one diagnosis on file
  assert.ok(r.findings.some((f) => f.code === 'DX-POINTER'))
  assert.equal(r.ok, false)
})

test('a replacement claim with no ICN is blocked', () => {
  const r = scrubClaim({ ...claim([line('99214')]), claimFrequencyCode: '7' })
  assert.ok(r.findings.some((f) => f.code === 'FREQ-ICN'))
  assert.equal(r.ok, false)
})

test('telehealth POS requires a telehealth modifier', () => {
  const noMod = scrubClaim(claim([line('99214')], { placeOfService: '10' }))
  assert.ok(noMod.findings.some((f) => f.code === 'TELEHEALTH-MOD'))
  const withMod = scrubClaim(claim([line('99214', { modifiers: ['95'] })], { placeOfService: '10' }))
  assert.ok(!withMod.findings.some((f) => f.code === 'TELEHEALTH-MOD'))
})

test('the jurisdiction layer applies Oklahoma notes by filing type, and is empty for an unmodeled state', () => {
  const mb = scrubClaim(claim([line('99214')], { claimFilingCode: 'MB' }), OKLAHOMA)
  assert.ok(mb.findings.some((f) => f.code === 'OK-MAC-JH' && f.source === 'jurisdiction'))
  const mc = scrubClaim(claim([line('99214')], { claimFilingCode: 'MC' }), OKLAHOMA)
  assert.ok(mc.findings.some((f) => f.code === 'OK-MCD-SOONERCARE'))
  // A state with no layer yet → national edits only, no jurisdiction findings.
  const tx = scrubClaim(claim([line('99214')], { claimFilingCode: 'MB' }), getJurisdiction('TX'))
  assert.ok(!tx.findings.some((f) => f.source === 'jurisdiction'))
})
