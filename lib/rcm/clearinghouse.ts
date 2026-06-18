import type { Claim, Remittance, RemittanceLine } from '../canonical'
import { parse837 } from '../adapters/edi'
import type { RateLookup } from '../diff'
import type { PayerDirectory } from './payer-directory'
import type { EnrollmentRegistry } from './enrollment'
import { StediClearinghouse, stediFromEnv, type StediConfig } from './stedi-clearinghouse'

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

/** Clearinghouses we can route through. `mock` is the only one implemented. */
export type ClearinghouseProvider = 'mock' | 'stedi' | 'claimmd' | 'availity' | 'office_ally'

export type ClaimStatusCategory = 'accepted' | 'pending' | 'finalized' | 'rejected' | 'unknown'

/** 276/277-equivalent: where a previously submitted claim currently stands. */
export interface ClaimStatusResponse {
  claimControlNumber: string
  category: ClaimStatusCategory
  description: string
}

export interface Clearinghouse {
  /** Submit an X12 837 document; returns one ack per claim (277CA-equivalent). */
  submit(edi837: string): Promise<SubmissionAck[]>
  /** Poll claim status (276/277-equivalent) for previously submitted claims. */
  checkStatus(claimControlNumbers: string[]): Promise<ClaimStatusResponse[]>
  /** Pull remittances (835-equivalent) for previously accepted claims. */
  fetchRemittances(): Promise<Remittance[]>
}

/** Pre-submission validation — the kind of scrub a clearinghouse rejects on. */
export function validateClaim(claim: Claim): { ok: boolean; reason?: string } {
  if (!claim.payer.externalId) return { ok: false, reason: 'Missing payer id' }
  if (claim.lines.length === 0) return { ok: false, reason: 'No service lines' }
  if (claim.lines.some((l) => !l.cptHcpcs)) return { ok: false, reason: 'Service line missing CPT/HCPCS' }
  if (claim.totalBilledCents <= 0) return { ok: false, reason: 'Non-positive total charge' }
  // A replacement (7) or void (8) must reference the payer's original claim (ICN/DCN).
  if ((claim.claimFrequencyCode === '7' || claim.claimFrequencyCode === '8') && !claim.originalClaimRef) {
    return { ok: false, reason: 'Replacement/void claim requires the original payer claim control number (ICN)' }
  }
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

  async submit(edi837: string): Promise<SubmissionAck[]> {
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

  async checkStatus(claimControlNumbers: string[]): Promise<ClaimStatusResponse[]> {
    const accepted = new Set(this.accepted.map((c) => c.controlNumber))
    return claimControlNumbers.map((cn) =>
      accepted.has(cn)
        ? { claimControlNumber: cn, category: 'finalized', description: 'Adjudicated (mock) — remittance available.' }
        : { claimControlNumber: cn, category: 'unknown', description: 'No record of this claim at the clearinghouse.' },
    )
  }

  async fetchRemittances(): Promise<Remittance[]> {
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

/**
 * Submission config. A real provider transmits real claims to payers, so it is
 * gated behind the COMPLIANCE.md PHI gate and needs a payer directory +
 * enrollment registry in place before anything goes out.
 */
export interface ClearinghouseConfig {
  provider: ClearinghouseProvider
  rates: RateLookup
  submitterId?: string
  payerDirectory?: PayerDirectory
  enrollment?: EnrollmentRegistry
  /** Real providers move PHI — refuse unless the COMPLIANCE.md gate is open. */
  allowRealPhi?: boolean
  /** Stedi adapter options (api key, sandbox flag). Falls back to STEDI_* env. */
  stedi?: StediConfig
}

/**
 * Provider-agnostic factory. Today only the mock is implemented; a real adapter
 * (Stedi / Claim.MD / Availity / Office Ally) drops in behind the Clearinghouse
 * interface — same money math, same canonical model, nothing changes above this
 * seam.
 */
export function createClearinghouse(config: ClearinghouseConfig): Clearinghouse {
  switch (config.provider) {
    case 'mock':
      return new MockClearinghouse(config.rates)
    case 'stedi': {
      const stedi = config.stedi ?? stediFromEnv(config.payerDirectory)
      const production = stedi.sandbox === false
      if (production && !config.allowRealPhi) {
        throw new Error(
          'Stedi in production transmits real claims/PHI to payers — gated by COMPLIANCE.md. ' +
            'Set allowRealPhi=true (ALLOW_REAL_PHI) only after a BAA + payer enrollment are in place. ' +
            'Use sandbox mode (STEDI_SANDBOX=true) for synthetic testing.',
        )
      }
      return new StediClearinghouse({ ...stedi, payerDirectory: stedi.payerDirectory ?? config.payerDirectory })
    }
    case 'claimmd':
    case 'availity':
    case 'office_ally':
      if (!config.allowRealPhi) {
        throw new Error(
          `Clearinghouse '${config.provider}' transmits real claims to payers and is gated by COMPLIANCE.md. ` +
            'Set allowRealPhi=true (ALLOW_REAL_PHI) only after a BAA + payer enrollment are in place.',
        )
      }
      throw new Error(
        `Clearinghouse adapter '${config.provider}' is not implemented yet — wire it behind the Clearinghouse interface.`,
      )
    default: {
      const exhaustive: never = config.provider
      throw new Error(`Unknown clearinghouse provider: ${String(exhaustive)}`)
    }
  }
}
