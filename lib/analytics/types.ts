import type { Cents } from '../canonical'

/**
 * Analytics inputs — the canonical shapes the A/R aging and denial reports
 * consume. In production these are derived from the ledger (outstanding balances
 * with their service dates) and the diff/remittance denials. Until real data
 * flows (post-BAA), lib/analytics/sample.ts provides a deterministic synthetic
 * book. The report builders never see a vendor specific — just these.
 */

/** One outstanding receivable (an account/claim balance still owed), aged by service date. */
export interface Receivable {
  claimControlNumber: string
  payerName: string
  payerExternalId: string
  patientName?: string
  /** Date of service (YYYY-MM-DD) — the aging anchor. */
  dateOfService: string
  /** Still owed by the payer. */
  insuranceArCents: Cents
  /** Still owed by the patient. */
  patientArCents: Cents
}

/** One adjudicated denial (a denied line/claim with its CARC reason). */
export interface DenialRecord {
  claimControlNumber: string
  payerName: string
  payerExternalId: string
  dateOfService: string
  /** Claim Adjustment Reason Code (HIPAA standard). */
  carcCode: string
  deniedCents: Cents
}
