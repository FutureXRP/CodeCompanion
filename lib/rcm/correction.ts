import type { Claim } from '../canonical'

/**
 * Claim correction & resubmission (Rung 1).
 *
 * A claim the payer ALREADY adjudicated is fixed with a replacement (frequency 7)
 * or withdrawn with a void (frequency 8). Both must reference the payer's
 * original claim control number — the ICN/DCN, carried in 837 REF*F8 — so the
 * payer knows which claim on file to supersede.
 *
 * This is NOT how a *rejected* claim is handled: a rejection never reached
 * adjudication, so there is no claim on file to replace. Fix it and resend as a
 * brand-new original (frequency 1, no ICN). lib/rcm/worklist.ts routes which is
 * which. DETERMINISTIC — no LLM shapes a claim or a dollar figure here.
 */

export interface CorrectionInput {
  /** The payer's claim control number (ICN/DCN) from the 277/835. Required. */
  payerClaimControlNumber: string
  /** Control number for the corrected claim; defaults to the original's. */
  newControlNumber?: string
  /** Apply the edits (new code, units, modifier, …) for a replacement. */
  revise?: (claim: Claim) => Claim
}

/** Keep the claim total consistent with its lines after any edit. */
function recomputeTotal(claim: Claim): Claim {
  return { ...claim, totalBilledCents: claim.lines.reduce((sum, l) => sum + l.billedCents, 0) }
}

/**
 * Build a replacement (corrected) claim — frequency 7, referencing the ICN.
 * Use for a claim that was adjudicated but coded wrong: bad CPT, wrong units, a
 * missing modifier. Pass `revise` to apply the fix.
 */
export function correctClaim(original: Claim, input: CorrectionInput): Claim {
  if (!input.payerClaimControlNumber) {
    throw new Error('correctClaim: payerClaimControlNumber (the original ICN/DCN) is required for a frequency-7 replacement')
  }
  const revised = input.revise ? input.revise(original) : original
  return recomputeTotal({
    ...revised,
    controlNumber: input.newControlNumber ?? original.controlNumber,
    claimFrequencyCode: '7',
    originalClaimRef: input.payerClaimControlNumber,
  })
}

/**
 * Build a void/cancel of a prior claim — frequency 8, referencing the ICN. The
 * claim is withdrawn as billed; no line edits apply.
 */
export function voidClaim(original: Claim, payerClaimControlNumber: string, newControlNumber?: string): Claim {
  if (!payerClaimControlNumber) {
    throw new Error('voidClaim: payerClaimControlNumber (the original ICN/DCN) is required for a frequency-8 void')
  }
  return {
    ...original,
    controlNumber: newControlNumber ?? original.controlNumber,
    claimFrequencyCode: '8',
    originalClaimRef: payerClaimControlNumber,
  }
}
