import type { Cents } from '../canonical'

/**
 * The patient ledger (Rung 1) — the practice's financial system of record.
 *
 * When the EHR is clinical-only (it holds the chart, not the money), THIS is
 * where a balance lives. Every charge, payment, and adjustment is an append-only
 * ledger entry; balances are derived by summation, never mutated in place. That
 * makes the ledger auditable and reproducible — the same discipline as the diff
 * engine. DETERMINISTIC: no LLM ever produces a figure here (CLAUDE.md).
 *
 * Each entry carries its effect on two buckets:
 *   - insuranceArCents — what is still expected from the payer
 *   - patientArCents    — what the patient owes (the statement balance)
 * A line is born as a charge in the insurance bucket; the 835 pays it down,
 * writes off the contractual portion, and *transfers* the patient-responsibility
 * portion into the patient bucket. A patient payment then draws that down.
 */

export type LedgerEntryType =
  | 'charge' // 837: we billed this line — opens insurance AR
  | 'insurance_payment' // 835: payer paid (insurance AR ↓)
  | 'contractual_adjustment' // 835 CO group: contractual write-off, billable to no one (insurance AR ↓)
  | 'payer_adjustment' // 835 OA/PI group: other payer adjustment (insurance AR ↓)
  | 'patient_responsibility' // 835 PR group: transfer insurance AR → patient AR (deductible/coinsurance/copay)
  | 'patient_payment' // patient paid (patient AR ↓)
  | 'patient_writeoff' // small-balance / charity write-off (patient AR ↓)

export type LedgerSource = '837' | '835' | 'manual'

export interface LedgerEntry {
  /** Deterministic id derived from the source line — stable across re-runs. */
  id: string
  type: LedgerEntryType
  claimControlNumber: string
  /** Canonical claim line id `${controlNumber}:${lineNumber}` when known. */
  claimLineId?: string
  cptHcpcs?: string
  dateOfService?: string
  /** Patient account key — subscriber memberId when known, else the claim control number. */
  accountKey: string
  patientName?: string
  payerName?: string
  /** Signed effect on what the payer still owes (cents). */
  insuranceDeltaCents: Cents
  /** Signed effect on what the patient still owes (cents). */
  patientDeltaCents: Cents
  source: LedgerSource
  /** CARC code for an adjustment / patient-responsibility entry, when present. */
  carcCode?: string
  /** Deterministic, template memo. NEVER LLM-generated. */
  memo: string
  postedAt: string
}

/** A patient payment against the ledger (card / cash / check / ACH). */
export interface PatientPayment {
  /** Stable id for the payment, when the caller has one. */
  id?: string
  /** Apply to a specific claim, or to the account directly. */
  claimControlNumber?: string
  accountKey?: string
  patientName?: string
  amountCents: Cents
  method?: 'card' | 'cash' | 'check' | 'ach'
  postedAt?: string
}

/** Derived balance for a set of ledger entries (an account, a claim, or the book). */
export interface AccountBalance {
  chargedCents: Cents
  insurancePaidCents: Cents
  contractualAdjCents: Cents
  otherAdjCents: Cents
  /** Total moved to patient responsibility (gross, before patient payments). */
  patientRespCents: Cents
  patientPaidCents: Cents
  patientWriteoffCents: Cents
  /** Outstanding from the payer. */
  insuranceArCents: Cents
  /** Outstanding from the patient — the statement balance. */
  patientArCents: Cents
  /** insuranceArCents + patientArCents. */
  totalBalanceCents: Cents
}

/** Where an account's balance currently sits — the ledger-native status. */
export type AccountStanding = 'awaiting_payer' | 'patient_owes' | 'settled' | 'credit'

export interface PatientAccount {
  accountKey: string
  patientName?: string
  payerName?: string
  /** Claim control numbers contributing to this account. */
  claims: string[]
  entries: LedgerEntry[]
  balance: AccountBalance
  standing: AccountStanding
}

export interface LedgerResult {
  accounts: PatientAccount[]
  entries: LedgerEntry[]
  totals: AccountBalance
}
