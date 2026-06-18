import type { Cents } from '../canonical'
import type { LedgerEntry, PatientAccount } from './types'

/**
 * Patient statement — the bill the practice sends the patient.
 *
 * NOT an EOB: an Explanation of Benefits is produced and mailed by the *payer*.
 * This is the practice-side statement, derived deterministically from the ledger
 * (the 835 already told us the patient-responsibility split). Every figure is a
 * sum of ledger entries — no LLM. Print-and-mail / electronic delivery is a
 * downstream vendor concern; this produces the numbers and line detail.
 */

export interface StatementLine {
  cptHcpcs?: string
  dateOfService?: string
  chargedCents: Cents
  insurancePaidCents: Cents
  adjustedCents: Cents
  patientRespCents: Cents
}

export interface PatientStatement {
  accountKey: string
  patientName?: string
  payerName?: string
  asOf: string
  lines: StatementLine[]
  /** Net amount the patient owes today (after their payments). */
  amountDueCents: Cents
}

/** Group an account's entries into per-service-line statement rows. */
export function buildStatement(account: PatientAccount, asOf: string = new Date().toISOString()): PatientStatement {
  // Anchor a statement line on each charge; gather the matching 835 entries by line.
  const charges = account.entries.filter((e) => e.type === 'charge')
  const lines: StatementLine[] = charges.map((charge) => {
    const siblings = account.entries.filter((e) => sameLine(e, charge) && e.type !== 'charge')
    let insurancePaid = 0
    let adjusted = 0
    let patientResp = 0
    for (const e of siblings) {
      if (e.type === 'insurance_payment') insurancePaid += -e.insuranceDeltaCents
      else if (e.type === 'contractual_adjustment' || e.type === 'payer_adjustment') adjusted += -e.insuranceDeltaCents
      else if (e.type === 'patient_responsibility') patientResp += e.patientDeltaCents
    }
    return {
      cptHcpcs: charge.cptHcpcs,
      dateOfService: charge.dateOfService,
      chargedCents: charge.insuranceDeltaCents,
      insurancePaidCents: insurancePaid,
      adjustedCents: adjusted,
      patientRespCents: patientResp,
    }
  })

  return {
    accountKey: account.accountKey,
    patientName: account.patientName,
    payerName: account.payerName,
    asOf,
    lines,
    amountDueCents: account.balance.patientArCents,
  }
}

/** Two entries belong to the same service line (by claim line id, else claim + cpt). */
function sameLine(a: LedgerEntry, b: LedgerEntry): boolean {
  if (a.claimLineId && b.claimLineId) return a.claimLineId === b.claimLineId
  return a.claimControlNumber === b.claimControlNumber && a.cptHcpcs === b.cptHcpcs
}
