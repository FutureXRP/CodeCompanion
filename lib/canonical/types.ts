import type { Cents } from './money'

/**
 * The canonical data model — the single source of truth.
 *
 * Adapters (lib/adapters/*) normalize every source into these types; everything
 * downstream (diff engine, read-views, corpus transform) reads ONLY from here
 * and never sees a vendor specific. Types only — no logic, no vendor fields.
 */

export type SourceAdapter = 'athena' | 'edi' | 'fhir'

export interface Payer {
  /** Stable external payer identifier (the payer's EDI id), e.g. "00123". */
  externalId: string
  name: string
}

export interface ClaimLine {
  /** Deterministic id: `${claimControlNumber}:${lineNumber}`. */
  id: string
  lineNumber: number
  cptHcpcs: string
  modifiers: string[]
  units: number
  /** 1-based pointers into the parent claim's `diagnoses` array. */
  diagnosisPointers: number[]
  billedCents: Cents
}

export interface Claim {
  /** Provider's claim control number. The join key to remittances. */
  controlNumber: string
  payer: Payer
  /** Rendering or billing provider NPI, when present. */
  providerNpi?: string
  /** ICD codes in pointer order; (index + 1) === diagnosis pointer. */
  diagnoses: string[]
  dateOfService?: string
  placeOfService?: string
  totalBilledCents: Cents
  sourceAdapter: SourceAdapter
  lines: ClaimLine[]
}

export interface Adjustment {
  /** Claim adjustment group code: CO, PR, OA, PI. */
  groupCode: string
  /** Claim Adjustment Reason Code. */
  carcCode: string
  /** Remittance Advice Remark Code, when present. */
  rarcCode?: string
  amountCents: Cents
}

export interface RemittanceLine {
  cptHcpcs: string
  modifiers: string[]
  units: number
  billedCents: Cents
  paidCents: Cents
  /** Allowed = billed - sum(contractual CO adjustments). Derived. */
  allowedCents: Cents
  patientRespCents: Cents
  adjustments: Adjustment[]
}

export interface Remittance {
  /** Provider's claim control number — joins to `Claim.controlNumber`. */
  claimControlNumber: string
  /** Payer's own claim control number. */
  payerClaimControlNumber: string
  payer: Payer
  /** Claim status code from the remittance (1 = processed as primary, etc.). */
  claimStatusCode: string
  totalBilledCents: Cents
  totalPaidCents: Cents
  patientRespCents: Cents
  lines: RemittanceLine[]
}

export interface FeeScheduleLine {
  payerExternalId: string
  cptHcpcs: string
  modifier?: string
  contractedCents: Cents
}

export type FindingType = 'underpayment' | 'denial' | 'undercoding' | 'unadjudicated'
export type FindingStatus = 'open' | 'appealing' | 'recovered' | 'terminal'

export interface Finding {
  /** Deterministic id: `${type}:${claimLineId}`. */
  id: string
  type: FindingType
  claimControlNumber: string
  claimLineId: string
  payerName: string
  payerExternalId: string
  cptHcpcs: string
  modifiers: string[]
  dateOfService?: string
  /** What we expected (contracted rate, or next-level rate for undercoding). */
  expectedCents: Cents
  /** What was actually paid. */
  actualCents: Cents
  /** expectedCents - actualCents. */
  deltaCents: Cents
  /** Recoverable dollars used for ranking; never negative. */
  recoverableCents: Cents
  appealable: boolean
  status: FindingStatus
  carcCode?: string
  rarcCode?: string
  /** Deterministic, template-generated explanation. NEVER LLM-generated. */
  reason: string
  detectedAt: string
}
