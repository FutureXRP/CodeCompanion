import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim, ClaimLine, ClaimTracking, FeeScheduleLine } from '../lib/canonical'
import { FeeSchedule } from '../lib/adapters/fee-schedule'
import { MockTebraSource, sampleTebraContractRates } from '../lib/adapters/tebra'
import { reviewClaim, reviewClaims, runTebraPreApproval, type ReviewContext } from '../lib/capture'
import { buildPostingWorkbench } from '../lib/found-money/workbench'

const RATES: FeeScheduleLine[] = sampleTebraContractRates()
const ctx = (assembledBy: ReviewContext['assembledBy'] = 'pm'): ReviewContext => ({ rates: new FeeSchedule(RATES), assembledBy })

function line(id: string, cptHcpcs: string, billedCents: number, diagnosisPointers: number[], modifiers: string[] = []): ClaimLine {
  return { id, lineNumber: Number(id.split(':')[1]), cptHcpcs, modifiers, units: 1, diagnosisPointers, billedCents }
}

function claim(controlNumber: string, payer: { externalId: string; name: string }, diagnoses: string[], lines: ClaimLine[], filing?: string): Claim {
  return {
    controlNumber,
    payer,
    providerNpi: '1234567893',
    diagnoses,
    dateOfService: '2026-01-15',
    placeOfService: '11',
    totalBilledCents: lines.reduce((s, l) => s + l.billedCents, 0),
    sourceAdapter: 'tebra',
    lines,
    subscriber: { memberId: 'P1', firstName: 'TEST', lastName: 'PATIENT' }, // no address — the PM holds it
    billingProvider: { npi: '1234567893', organizationName: 'SquareOne Medical' },
    claimFilingCode: filing,
  }
}
const MEDICARE = { externalId: 'MEDICARE', name: 'Medicare' }
const AETNA = { externalId: 'AETNA', name: 'Aetna' }

test('a clean encounter is ready; the PM-held subscriber address is not a blocker', () => {
  const c = claim('X-1', AETNA, ['K219'], [line('X-1:1', '99214', 15000, [1]), line('X-1:2', '36415', 2500, [1])])
  const pm = reviewClaim(c, 'draft', ctx('pm'))
  assert.equal(pm.verdict, 'ready')
  assert.deepEqual(pm.findings, [])
  assert.equal(pm.expectedCents, 11500 + 2500) // AETNA 99214 rate + billed fallback for 36415
  // When CodeCompanion builds the 837 itself the address matters again.
  const own = reviewClaim(c, 'draft', ctx('codecompanion'))
  assert.equal(own.verdict, 'blocked')
  assert.equal(own.findings[0].code, 'SCRUB:ADDR-REQUIRED')
})

test('scrubber edits become blockers/warnings with the line’s contracted dollars at risk', () => {
  const c = claim('X-2', AETNA, ['J4520'], [line('X-2:1', '99214', 15000, [1]), line('X-2:2', '94760', 1500, [1]), line('X-2:3', '93000', 4500, [])])
  const r = reviewClaim(c, 'review', ctx())
  assert.equal(r.verdict, 'blocked')
  assert.deepEqual(r.findings.map((f) => [f.code, f.severity, f.impact, f.impactCents]), [
    ['CAP-LINE-DX', 'blocker', 'at_risk', 2000], // 93000 has no diagnosis — rejects
    ['SCRUB:CCI-25', 'warning', 'at_risk', 11500], // E/M + EKG without 25 — the E/M bundles
    ['SCRUB:EM-BUNDLED', 'warning', 'none', 0], // pulse ox never pays; dropping it loses nothing
  ])
  assert.equal(r.atRiskCents, 13500)
  assert.equal(r.expectedCents, 11500 + 1500 + 2000)
})

test('at risk is capped at what the encounter is worth', () => {
  const c = claim('X-3', AETNA, [], [line('X-3:1', '99213', 12000, [])]) // no diagnosis at all + a line without one
  const r = reviewClaim(c, 'draft', ctx())
  assert.ok(r.findings.some((f) => f.code === 'SCRUB:DX-MISSING'))
  assert.ok(r.findings.some((f) => f.code === 'CAP-LINE-DX'))
  assert.equal(r.atRiskCents, r.expectedCents) // not 2× the claim
})

test('capture: vaccine without administration; administration without vaccine', () => {
  const noAdmin = reviewClaim(claim('V-1', AETNA, ['Z23'], [line('V-1:1', '90686', 2400, [1])]), 'draft', ctx())
  assert.deepEqual(noAdmin.findings.map((f) => [f.code, f.impact, f.impactCents]), [['CAP-VAX-ADMIN', 'opportunity', 2500]])
  assert.equal(noAdmin.verdict, 'opportunities')
  const medicare = reviewClaim(claim('V-2', MEDICARE, ['Z23'], [line('V-2:1', '90686', 2400, [1])], 'MB'), 'draft', ctx())
  assert.equal(medicare.findings[0].impactCents, 3000) // G0008 rate for Medicare
  assert.match(medicare.findings[0].hint ?? '', /G0008/)
  const noProduct = reviewClaim(claim('V-3', AETNA, ['Z23'], [line('V-3:1', '90471', 2500, [1])]), 'draft', ctx())
  assert.deepEqual(noProduct.findings.map((f) => [f.code, f.severity, f.impactCents]), [['CAP-VAX-PRODUCT', 'warning', 2500]])
})

test('capture: E/M level support is conservative and priced from the contract', () => {
  const rich = claim('E-1', AETNA, ['J0290', 'R0789', 'E785', 'I10'], [line('E-1:1', '99213', 12000, [1, 2, 3, 4]), line('E-1:2', '36415', 2500, [3])])
  const r = reviewClaim(rich, 'draft', ctx())
  const level = r.findings.find((f) => f.code === 'CAP-EM-LEVEL')!
  assert.equal(level.severity, 'opportunity')
  assert.equal(level.impactCents, 11500 - 9500)
  assert.match(level.title, /99214/)
  // Fewer diagnoses or a single line → no flag (same thresholds as the diff).
  const thin = claim('E-2', AETNA, ['J0290', 'R0789'], [line('E-2:1', '99213', 12000, [1, 2]), line('E-2:2', '36415', 2500, [1])])
  assert.ok(!reviewClaim(thin, 'draft', ctx()).findings.some((f) => f.code === 'CAP-EM-LEVEL'))
  const single = claim('E-3', AETNA, ['J0290', 'R0789', 'E785', 'I10'], [line('E-3:1', '99213', 12000, [1, 2, 3, 4])])
  assert.ok(!reviewClaim(single, 'draft', ctx()).findings.some((f) => f.code === 'CAP-EM-LEVEL'))
})

test('capture: Medicare AWV add-ons, G2211 only on a pure E/M, preventive + problem needs 25', () => {
  const awv = reviewClaim(claim('M-1', MEDICARE, ['Z0000', 'I10'], [line('M-1:1', 'G0439', 18000, [1]), line('M-1:2', '99214', 15000, [2])], 'MB'), 'review', ctx())
  assert.deepEqual(awv.findings.map((f) => [f.code, f.cptHcpcs, f.impactCents]), [
    ['SCRUB:CCI-25', '99214', 11250],
    ['CAP-AWV-ADDON', '99497', 8600],
    ['CAP-AWV-ADDON', 'G0444', 1800],
  ])
  assert.ok(!awv.findings.some((f) => f.code === 'CAP-G2211')) // two lines → not a pure E/M
  assert.equal(awv.verdict, 'fix')

  const pure = reviewClaim(claim('M-2', MEDICARE, ['E1165', 'I10'], [line('M-2:1', '99213', 12000, [1, 2])], 'MB'), 'draft', ctx())
  assert.deepEqual(pure.findings.map((f) => [f.code, f.impactCents]), [['CAP-G2211', 1600]])
  assert.equal(pure.verdict, 'opportunities')
  const withG2211 = reviewClaim(claim('M-3', MEDICARE, ['E1165'], [line('M-3:1', '99213', 12000, [1]), line('M-3:2', 'G2211', 1600, [1])], 'MB'), 'draft', ctx())
  assert.ok(!withG2211.findings.some((f) => f.code === 'CAP-G2211'))
  assert.ok(!reviewClaim(claim('M-4', AETNA, ['E1165'], [line('M-4:1', '99213', 12000, [1])]), 'draft', ctx()).findings.some((f) => f.code === 'CAP-G2211'))

  const prev = reviewClaim(claim('P-1', AETNA, ['Z0000', 'J0290'], [line('P-1:1', '99396', 20000, [1]), line('P-1:2', '99213', 12000, [2])]), 'draft', ctx())
  assert.deepEqual(prev.findings.map((f) => f.code), ['CAP-PREV-25']) // the precise rule replaces the generic CCI-25
  assert.equal(prev.findings[0].impactCents, 9500)
})

test('capture: duplicate lines and zero charges', () => {
  const dup = reviewClaim(claim('D-1', AETNA, ['L0290'], [line('D-1:1', '17110', 9000, [1]), line('D-1:2', '17110', 9000, [1])]), 'draft', ctx())
  assert.ok(dup.findings.some((f) => f.code === 'CAP-DUP-LINE' && f.claimLineId === 'D-1:2' && f.impactCents === 9000))
  const repeated = reviewClaim(claim('D-2', AETNA, ['L0290'], [line('D-2:1', '17110', 9000, [1]), line('D-2:2', '17110', 9000, [1], ['59'])]), 'draft', ctx())
  assert.ok(!repeated.findings.some((f) => f.code === 'CAP-DUP-LINE'))
  const zero = reviewClaim(claim('Z-1', AETNA, ['I10'], [line('Z-1:1', '99213', 12000, [1]), line('Z-1:2', '93000', 0, [1])]), 'draft', ctx())
  assert.ok(zero.findings.some((f) => f.code === 'CAP-ZERO-CHARGE' && f.severity === 'blocker' && f.impactCents === 2000))
})

test('reviewClaims: approval status from tracking, verdict ordering, totals', () => {
  const a = claim('A', AETNA, ['K219'], [line('A:1', '99214', 15000, [1])])
  const b = claim('B', AETNA, ['J4520'], [line('B:1', '99214', 15000, [1]), line('B:2', '93000', 4500, [])])
  const tracking: ClaimTracking[] = [
    { claimControlNumber: 'A', claimLineId: 'A:1', status: 'draft', insuranceBalanceCents: 15000, patientBalanceCents: 0 },
    { claimControlNumber: 'B', claimLineId: 'B:1', status: 'review', insuranceBalanceCents: 15000, patientBalanceCents: 0 },
    { claimControlNumber: 'B', claimLineId: 'B:2', status: 'review', insuranceBalanceCents: 4500, patientBalanceCents: 0 },
  ]
  const report = reviewClaims([a, b], tracking, ctx(), new Date('2026-01-16T00:00:00Z'))
  assert.deepEqual(report.reviews.map((r) => [r.claimControlNumber, r.approvalStatus, r.verdict]), [['B', 'review', 'blocked'], ['A', 'draft', 'ready']])
  assert.deepEqual(report.totals.byVerdict, { blocked: 1, fix: 0, opportunities: 0, ready: 1 })
  assert.equal(report.totals.blockers, 1)
  assert.equal(report.totals.warnings, 1)
  assert.equal(report.generatedAt, '2026-01-16T00:00:00.000Z')
  // Draft / Review lines never reach the posting workbench.
  const wb = buildPostingWorkbench({ claims: [a, b], findings: [], tracking, rates: new FeeSchedule(RATES) })
  assert.equal(wb.items.length, 0)
})

test('pre-approval review straight from the Tebra mock: six pending encounters, deterministic dollars', async () => {
  const result = await runTebraPreApproval(new MockTebraSource(), { serviceDateFrom: '2026-01-15' }, sampleTebraContractRates(), new Date('2026-01-16T00:00:00Z'))
  assert.equal(result.claims.length, 6)
  assert.equal(result.remittances.length, 0) // nothing has been sent
  assert.ok(result.tracking.every((t) => t.status === 'draft' || t.status === 'review'))
  const { totals, reviews } = result.report
  assert.deepEqual(totals.byVerdict, { blocked: 1, fix: 3, opportunities: 1, ready: 1 })
  assert.equal(totals.encounters, 6)
  assert.equal(totals.blockers, 1)
  assert.equal(totals.warnings, 5)
  assert.equal(totals.opportunities, 5)
  assert.equal(totals.atRiskCents, 41450)
  assert.equal(totals.opportunityCents, 16500)
  assert.equal(totals.expectedCents, 79500)
  assert.deepEqual(
    reviews.map((r) => [r.claimControlNumber, r.approvalStatus, r.verdict, r.atRiskCents, r.opportunityCents]),
    [
      ['P-3006', 'review', 'blocked', 13500, 0],
      ['P-3001', 'review', 'fix', 11250, 10400],
      ['P-3002', 'draft', 'fix', 9500, 4500],
      ['P-3003', 'review', 'fix', 7200, 0],
      ['P-3005', 'draft', 'opportunities', 0, 1600],
      ['P-3004', 'draft', 'ready', 0, 0],
    ],
  )
})
