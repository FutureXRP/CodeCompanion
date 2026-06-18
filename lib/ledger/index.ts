import type { Claim, Remittance } from '../canonical'
import {
  accountKeyForClaim,
  patientNameForClaim,
  postClaimCharges,
  postPatientPayment,
  postRemittance,
} from './post'
import type {
  AccountBalance,
  AccountStanding,
  LedgerEntry,
  LedgerResult,
  PatientAccount,
  PatientPayment,
} from './types'

export * from './types'
export { postClaimCharges, postRemittance, postPatientPayment, accountKeyForClaim, patientNameForClaim } from './post'
export { buildStatement, type PatientStatement, type StatementLine } from './statement'

/** Derive every balance figure from a flat list of entries by summation. */
export function computeBalance(entries: LedgerEntry[]): AccountBalance {
  let charged = 0
  let insurancePaid = 0
  let contractualAdj = 0
  let otherAdj = 0
  let patientResp = 0
  let patientPaid = 0
  let patientWriteoff = 0
  let insuranceAr = 0
  let patientAr = 0

  for (const e of entries) {
    insuranceAr += e.insuranceDeltaCents
    patientAr += e.patientDeltaCents
    switch (e.type) {
      case 'charge':
        charged += e.insuranceDeltaCents
        break
      case 'insurance_payment':
        insurancePaid += -e.insuranceDeltaCents
        break
      case 'contractual_adjustment':
        contractualAdj += -e.insuranceDeltaCents
        break
      case 'payer_adjustment':
        otherAdj += -e.insuranceDeltaCents
        break
      case 'patient_responsibility':
        patientResp += e.patientDeltaCents
        break
      case 'patient_payment':
        patientPaid += -e.patientDeltaCents
        break
      case 'patient_writeoff':
        patientWriteoff += -e.patientDeltaCents
        break
    }
  }

  return {
    chargedCents: charged,
    insurancePaidCents: insurancePaid,
    contractualAdjCents: contractualAdj,
    otherAdjCents: otherAdj,
    patientRespCents: patientResp,
    patientPaidCents: patientPaid,
    patientWriteoffCents: patientWriteoff,
    insuranceArCents: insuranceAr,
    patientArCents: patientAr,
    totalBalanceCents: insuranceAr + patientAr,
  }
}

/** Where the balance sits — drives the ledger-native status label. */
export function standingFor(balance: AccountBalance): AccountStanding {
  if (balance.totalBalanceCents < 0) return 'credit'
  if (balance.insuranceArCents > 0) return 'awaiting_payer'
  if (balance.patientArCents > 0) return 'patient_owes'
  return 'settled'
}

/**
 * Post a full book: charges from every claim, payments + adjustments from every
 * remittance (matched to its claim), and any patient payments. Returns the flat
 * entry list, per-patient accounts with derived balances, and the grand totals.
 */
export function buildLedger(
  input: { claims: Claim[]; remittances: Remittance[]; payments?: PatientPayment[] },
  postedAt?: string,
): LedgerResult {
  const claimByCn = new Map(input.claims.map((c) => [c.controlNumber, c]))
  const entries: LedgerEntry[] = []

  for (const claim of input.claims) entries.push(...postClaimCharges(claim, postedAt))
  for (const remit of input.remittances) {
    entries.push(...postRemittance(remit, claimByCn.get(remit.claimControlNumber), postedAt))
  }
  for (const payment of input.payments ?? []) {
    const claim = payment.claimControlNumber ? claimByCn.get(payment.claimControlNumber) : undefined
    entries.push(
      postPatientPayment(
        {
          ...payment,
          accountKey: payment.accountKey ?? (claim ? accountKeyForClaim(claim) : payment.claimControlNumber),
          patientName: payment.patientName ?? (claim ? patientNameForClaim(claim) : undefined),
        },
        postedAt,
      ),
    )
  }

  return { accounts: accountsFromEntries(entries), entries, totals: computeBalance(entries) }
}

/** Group a flat entry list into per-patient accounts with derived balances. */
export function accountsFromEntries(entries: LedgerEntry[]): PatientAccount[] {
  const byAccount = new Map<string, LedgerEntry[]>()
  for (const e of entries) {
    const bucket = byAccount.get(e.accountKey)
    if (bucket) bucket.push(e)
    else byAccount.set(e.accountKey, [e])
  }

  const accounts: PatientAccount[] = [...byAccount.entries()].map(([accountKey, es]) => {
    const balance = computeBalance(es)
    return {
      accountKey,
      patientName: es.find((e) => e.patientName)?.patientName,
      payerName: es.find((e) => e.payerName)?.payerName,
      claims: [...new Set(es.map((e) => e.claimControlNumber).filter(Boolean))],
      entries: es,
      balance,
      standing: standingFor(balance),
    }
  })

  // Highest outstanding balance first — the work queue order.
  accounts.sort((a, b) => b.balance.totalBalanceCents - a.balance.totalBalanceCents)
  return accounts
}
