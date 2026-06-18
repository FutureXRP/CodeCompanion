import type { Claim, OtherPayer, OtherPayerLineAdjudication, Payer, Remittance } from '../canonical'

/**
 * Coordination of benefits (Rung 1) — bill the secondary payer after the primary.
 *
 * Once the primary's 835 posts, the patient-responsibility remainder may be owed
 * by a secondary plan, not the patient. The secondary claim re-sends the same
 * charges but carries the primary's adjudication (what it paid, its CAS
 * adjustments, per line) so the secondary can coordinate. DETERMINISTIC — the
 * COB amounts come straight from the primary 835, never invented.
 */

export interface SecondaryClaimOptions {
  /** Filing indicator for the secondary payer (CI commercial, MB Medicare, …). */
  claimFilingCode?: string
  /** Control number for the secondary claim; defaults to `${original}-S`. */
  newControlNumber?: string
}

/**
 * Build a secondary claim from the primary claim + the primary's remittance.
 * The destination payer becomes `secondary`; the primary is recorded under
 * `otherPayers` with its paid amount and per-line adjudication for the COB loops.
 */
export function buildSecondaryClaim(
  primaryClaim: Claim,
  primaryRemit: Remittance,
  secondary: Payer,
  opts: SecondaryClaimOptions = {},
): Claim {
  const lineAdjudications: OtherPayerLineAdjudication[] = primaryRemit.lines.map((rl) => ({
    cptHcpcs: rl.cptHcpcs,
    paidCents: rl.paidCents,
    adjustments: rl.adjustments,
  }))

  const primaryAsOther: OtherPayer = {
    payer: primaryClaim.payer,
    sequence: 'P',
    paidCents: primaryRemit.totalPaidCents,
    adjustments: primaryRemit.lines.flatMap((rl) => rl.adjustments),
    lineAdjudications,
  }

  return {
    ...primaryClaim,
    controlNumber: opts.newControlNumber ?? `${primaryClaim.controlNumber}-S`,
    payer: secondary,
    claimFilingCode: opts.claimFilingCode ?? primaryClaim.claimFilingCode,
    // A secondary submission is a new original to the secondary payer.
    claimFrequencyCode: '1',
    originalClaimRef: undefined,
    otherPayers: [primaryAsOther],
  }
}

/** The balance carried to the secondary = primary patient responsibility. */
export function secondaryBalanceCents(primaryRemit: Remittance): number {
  return primaryRemit.patientRespCents
}
