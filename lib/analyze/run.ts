import { parseClaimsFromText, parseRemittancesFromText } from '../adapters/edi'
import { loadFeeScheduleFromText } from '../adapters/fee-schedule'
import { runFoundMoneyFrom, type FoundMoneyReport } from '../found-money/run'
import { deriveClaimState, type ClaimState } from '../rcm/lifecycle'

/**
 * Self-serve analysis: parse a practice's own 837 + 835 + fee schedule (provided
 * as text, processed in memory — nothing persisted) and return both the Rung 0
 * found-money worklist and the Rung 1 claim lifecycle derived from the actual
 * remittance. This is what lets the practice test the whole pipeline on its own
 * (synthetic / de-identified until the BAA gate is closed) data.
 */

export interface ClaimTotals {
  total: number
  paid: number
  partiallyPaid: number
  denied: number
  submitted: number
}

export interface AnalyzeResult {
  foundMoney: FoundMoneyReport
  claims: ClaimState[]
  claimTotals: ClaimTotals
}

export function analyze(edi837: string, edi835: string, feeScheduleCsv: string): AnalyzeResult {
  const claims = parseClaimsFromText(edi837)
  const remittances = parseRemittancesFromText(edi835)
  const feeSchedule = loadFeeScheduleFromText(feeScheduleCsv)

  const foundMoney = runFoundMoneyFrom(claims, remittances, feeSchedule, 'upload')

  const remitByClaim = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  // No submission ack for already-billed history: status derives from the 835.
  const claimStates = claims.map((claim) =>
    deriveClaimState(claim, undefined, remitByClaim.get(claim.controlNumber)),
  )

  const claimTotals: ClaimTotals = {
    total: claimStates.length,
    paid: claimStates.filter((s) => s.status === 'paid').length,
    partiallyPaid: claimStates.filter((s) => s.status === 'partially_paid').length,
    denied: claimStates.filter((s) => s.status === 'denied').length,
    submitted: claimStates.filter((s) => s.status === 'submitted').length,
  }

  return { foundMoney, claims: claimStates, claimTotals }
}
