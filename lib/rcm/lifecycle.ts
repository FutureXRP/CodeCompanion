import type { Claim, Remittance } from '../canonical'
import type { SubmissionAck } from './clearinghouse'

/**
 * Claim lifecycle — the work a billing company does, made explicit so a practice
 * can run it in-house: built -> submitted -> accepted|rejected -> paid|partially_paid|denied.
 */
export type ClaimStatus =
  | 'built'
  | 'submitted'
  | 'rejected'
  | 'paid'
  | 'partially_paid'
  | 'denied'

export interface ClaimState {
  claimControlNumber: string
  payerName: string
  billedCents: number
  paidCents: number
  status: ClaimStatus
  payerClaimControlNumber?: string
  rejectReason?: string
}

export function deriveClaimState(
  claim: Claim,
  ack: SubmissionAck | undefined,
  remit: Remittance | undefined,
): ClaimState {
  const base = {
    claimControlNumber: claim.controlNumber,
    payerName: claim.payer.name,
    billedCents: claim.totalBilledCents,
    paidCents: 0,
    payerClaimControlNumber: ack?.payerClaimControlNumber,
  }

  if (ack?.status === 'rejected') {
    return { ...base, status: 'rejected', rejectReason: ack.rejectReason }
  }
  if (!remit) {
    return { ...base, status: 'submitted' }
  }

  const paidLines = remit.lines.filter((l) => l.paidCents > 0).length
  const totalLines = remit.lines.length
  const paidCents = remit.totalPaidCents
  const status: ClaimStatus =
    paidLines === 0 ? 'denied' : paidLines < totalLines ? 'partially_paid' : 'paid'

  return { ...base, paidCents, status }
}
