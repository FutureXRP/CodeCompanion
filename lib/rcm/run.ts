import type { Finding } from '../canonical'
import { loadClaims, generate837 } from '../adapters/edi'
import { loadFeeSchedule } from '../adapters/fee-schedule'
import { runDiff } from '../diff'
import { createClearinghouse } from './clearinghouse'
import { deriveClaimState, type ClaimState } from './lifecycle'

/**
 * The Rung 1 in-house RCM cycle, end to end:
 *   build claims -> generate 837 -> submit (clearinghouse) -> adjudicate ->
 *   post 835 -> derive claim lifecycle -> diff for a recovery worklist.
 *
 * Mock-first: runs against the MockClearinghouse on synthetic data. A real
 * clearinghouse adapter swaps in behind the same interface (gated on BAA +
 * ALLOW_REAL_PHI). This is what replaces a billing company's % of revenue.
 */
export interface RcmTotals {
  submitted: number
  accepted: number
  rejected: number
  paid: number
  partiallyPaid: number
  denied: number
  billedCents: number
  paidCents: number
  recoverableCents: number
}

export interface RcmReport {
  claims: ClaimState[]
  findings: Finding[]
  edi837: string
  totals: RcmTotals
  meta: { source: 'samples' | 'files'; generatedAt: string }
}

export function runRcmCycle(): RcmReport {
  const claims = loadClaims()
  const feeSchedule = loadFeeSchedule()
  const clearinghouse = createClearinghouse({ provider: 'mock', rates: feeSchedule, submitterId: 'BLAIRPC' })

  const edi837 = generate837(claims, { submitterId: 'BLAIRPC', controlNumber: '000000001' })
  const acks = clearinghouse.submit(edi837)
  const remittances = clearinghouse.fetchRemittances()
  const findings = runDiff(claims, remittances, feeSchedule)

  const ackByClaim = new Map(acks.map((a) => [a.claimControlNumber, a]))
  const remitByClaim = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  const states = claims.map((claim) =>
    deriveClaimState(claim, ackByClaim.get(claim.controlNumber), remitByClaim.get(claim.controlNumber)),
  )

  const totals: RcmTotals = {
    submitted: states.length,
    accepted: acks.filter((a) => a.status === 'accepted').length,
    rejected: states.filter((s) => s.status === 'rejected').length,
    paid: states.filter((s) => s.status === 'paid').length,
    partiallyPaid: states.filter((s) => s.status === 'partially_paid').length,
    denied: states.filter((s) => s.status === 'denied').length,
    billedCents: states.reduce((sum, s) => sum + s.billedCents, 0),
    paidCents: states.reduce((sum, s) => sum + s.paidCents, 0),
    recoverableCents: findings.reduce((sum, f) => sum + f.recoverableCents, 0),
  }

  return {
    claims: states,
    findings,
    edi837,
    totals,
    meta: {
      source: process.env.EDI_USE_SAMPLE_FILES === 'false' ? 'files' : 'samples',
      generatedAt: new Date().toISOString(),
    },
  }
}
