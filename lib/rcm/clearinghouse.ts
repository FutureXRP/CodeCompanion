import type { Claim, Remittance, RemittanceLine } from '../canonical'
import { parse837 } from '../adapters/edi'
import type { RateLookup } from '../diff'

/**
 * Clearinghouse boundary (Rung 1). Submitting 837s and pulling 835s is how a
 * practice bills payers directly instead of paying a billing company a % of
 * revenue. This is the interface; MockClearinghouse implements it for local,
 * synthetic-data demos — exactly the ATHENA_USE_MOCK posture.
 *
 * A real adapter (Availity / Change / Claim.MD / Stedi / Office Ally) is the
 * swap-in: it requires accounts, payer EDI enrollment, credentials, and a signed
 * BAA, and must be gated behind ALLOW_REAL_PHI (COMPLIANCE.md). It would receive
 * real 835 files and parse them with the existing parse835 — no new money math.
 */

export type SubmissionStatus = 'accepted' | 'rejected'

export interface SubmissionAck {
  claimControlNumber: string
  status: SubmissionStatus
  payerClaimControlNumber?: string
  rejectReason?: string
}

export interface Clearinghouse {
  /** Submit an X12 837 document; returns one ack per claim (277CA-equivalent). */
  submit(edi837: string): SubmissionAck[]
  /** Pull remittances (835-equivalent) for previously accepted claims. */
  fetchRemittances(): Remittance[]
}

/** Pre-submission validation — the kind of scrub a clearinghouse rejects on. */
export function validateClaim(claim: Claim): { ok: boolean; reason?: string } {
  if (!claim.payer.externalId) return { ok: false, reason: 'Missing payer id' }
  if (claim.lines.length === 0) return { ok: false, reason: 'No service lines' }
  if (claim.lines.some((l) => !l.cptHcpcs)) return { ok: false, reason: 'Service line missing CPT/HCPCS' }
  if (claim.totalBilledCents <= 0) return { ok: false, reason: 'Non-positive total charge' }
  return { ok: true }
}

// Mock adjudication heuristics — clearly simulated payer behavior, not real.
const DENY_AUTH_CPTS = new Set(['99215']) // simulate a missing-prior-auth denial
const CARC_AUTH = '197'
const CARC_CONTRACTUAL = '45'

export class MockClearinghouse implements Clearinghouse {
  private accepted: Claim[] = []
  private seq = 0

  constructor(private readonly rates: RateLookup) {}

  submit(edi837: string): SubmissionAck[] {
    const claims = parse837(edi837)
    return claims.map((claim) => {
      const check = validateClaim(claim)
      if (!check.ok) {
        return { claimControlNumber: claim.controlNumber, status: 'rejected', rejectReason: check.reason }
      }
      this.seq += 1
      this.accepted.push(claim)
      return {
        claimControlNumber: claim.controlNumber,
        status: 'accepted',
        payerClaimControlNumber: `CH${String(this.seq).padStart(6, '0')}`,
      }
    })
  }

  fetchRemittances(): Remittance[] {
    return this.accepted.map((claim) => {
      const lines: RemittanceLine[] = claim.lines.map((line) => {
        const contracted = this.rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0])
        const allowed = contracted ?? line.billedCents
        const denied = DENY_AUTH_CPTS.has(line.cptHcpcs)
        const adjustments = denied
          ? [{ groupCode: 'CO', carcCode: CARC_AUTH, amountCents: line.billedCents }]
          : line.billedCents > allowed
            ? [{ groupCode: 'CO', carcCode: CARC_CONTRACTUAL, amountCents: line.billedCents - allowed }]
            : []
        return {
          cptHcpcs: line.cptHcpcs,
          modifiers: line.modifiers,
          units: line.units,
          billedCents: line.billedCents,
          paidCents: denied ? 0 : allowed,
          allowedCents: denied ? 0 : allowed,
          patientRespCents: 0,
          adjustments,
        }
      })
      const totalPaid = lines.reduce((sum, l) => sum + l.paidCents, 0)
      return {
        claimControlNumber: claim.controlNumber,
        payerClaimControlNumber: `CH-${claim.controlNumber}`,
        payer: claim.payer,
        claimStatusCode: totalPaid > 0 ? '1' : '4',
        totalBilledCents: claim.totalBilledCents,
        totalPaidCents: totalPaid,
        patientRespCents: 0,
        lines,
      }
    })
  }
}
