import type { ClearinghouseProvider } from './clearinghouse'

/**
 * Payer enrollment — the operational gate that decides whether a claim can
 * actually be transmitted electronically yet. Receiving ERAs (835) almost
 * always requires enrolling with each payer; some payers also gate *claim*
 * submission behind enrollment (most government, some BCBS/Medicaid). This is
 * the deterministic record of where each (provider × payer × transaction) sits,
 * so the platform never transmits to a payer that isn't actually live.
 */

export type EdiTransaction = 'claim' | 'era' | 'eligibility'
export type EnrollmentState = 'not_required' | 'not_started' | 'pending' | 'approved' | 'rejected'

export interface EnrollmentRecord {
  providerNpi: string
  payerExternalId: string
  clearinghouse: ClearinghouseProvider
  transaction: EdiTransaction
  state: EnrollmentState
  /** When an approved enrollment becomes effective. */
  effectiveDate?: string
  note?: string
}

export interface SubmitGate {
  ok: boolean
  reason: string
}

function key(npi: string, payer: string, ch: ClearinghouseProvider, tx: EdiTransaction): string {
  return [npi, payer, ch, tx].join('|')
}

export class EnrollmentRegistry {
  private records = new Map<string, EnrollmentRecord>()

  constructor(records: EnrollmentRecord[] = []) {
    for (const r of records) this.upsert(r)
  }

  upsert(record: EnrollmentRecord): void {
    this.records.set(key(record.providerNpi, record.payerExternalId, record.clearinghouse, record.transaction), record)
  }

  get(providerNpi: string, payerExternalId: string, clearinghouse: ClearinghouseProvider, transaction: EdiTransaction): EnrollmentRecord | undefined {
    return this.records.get(key(providerNpi, payerExternalId, clearinghouse, transaction))
  }

  /**
   * Can this provider transmit this transaction to this payer right now?
   * Unknown (no record) is treated as "not enrolled" — fail safe, never assume
   * a payer is live.
   */
  canSubmit(providerNpi: string, payerExternalId: string, clearinghouse: ClearinghouseProvider, transaction: EdiTransaction): SubmitGate {
    const rec = this.get(providerNpi, payerExternalId, clearinghouse, transaction)
    if (!rec) {
      return { ok: false, reason: `No ${transaction} enrollment on file for payer ${payerExternalId} — start enrollment before transmitting.` }
    }
    switch (rec.state) {
      case 'not_required':
        return { ok: true, reason: `No ${transaction} enrollment required for payer ${payerExternalId}.` }
      case 'approved':
        return { ok: true, reason: `Enrolled for ${transaction} with payer ${payerExternalId}${rec.effectiveDate ? ` (effective ${rec.effectiveDate})` : ''}.` }
      case 'pending':
        return { ok: false, reason: `${transaction} enrollment for payer ${payerExternalId} is pending — not yet live.` }
      case 'rejected':
        return { ok: false, reason: `${transaction} enrollment for payer ${payerExternalId} was rejected${rec.note ? `: ${rec.note}` : ''}.` }
      case 'not_started':
        return { ok: false, reason: `${transaction} enrollment for payer ${payerExternalId} not started.` }
    }
  }

  get size(): number {
    return this.records.size
  }
}
