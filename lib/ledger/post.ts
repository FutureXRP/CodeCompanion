import type { Claim, Remittance } from '../canonical'
import { formatCents } from '../canonical'
import type { LedgerEntry, PatientPayment } from './types'

/**
 * Deterministic posting: canonical claims + remittances + patient payments →
 * ledger entries. This is the payment-posting step a billing company does by
 * hand off the 835 — here it is pure, reproducible code. No money is invented;
 * every figure traces back to an 837 line, an 835 segment, or a recorded payment.
 */

/** Stable line key for matching an 835 line back to its 837 line (modifier-order independent). */
function lineKey(cptHcpcs: string, modifiers: string[]): string {
  return `${cptHcpcs}|${[...modifiers].sort().join(',')}`
}

/** The patient bucket is keyed by the insured's member id when known. */
export function accountKeyForClaim(claim: Claim): string {
  return claim.subscriber?.memberId || claim.controlNumber
}

export function patientNameForClaim(claim: Claim): string | undefined {
  const s = claim.subscriber
  if (!s) return undefined
  return [s.firstName, s.lastName].filter(Boolean).join(' ') || undefined
}

/** Plain-English label for a patient-responsibility CARC (PR group). */
function patientRespLabel(carc?: string): string {
  switch (carc) {
    case '1':
      return 'deductible'
    case '2':
      return 'coinsurance'
    case '3':
      return 'copay'
    default:
      return 'patient responsibility'
  }
}

/**
 * Charges from a claim — one entry per service line, opening insurance AR.
 * A void (frequency 8) withdraws a prior claim and posts no new charge.
 */
export function postClaimCharges(claim: Claim, postedAt: string = new Date().toISOString()): LedgerEntry[] {
  if (claim.claimFrequencyCode === '8') return []
  const accountKey = accountKeyForClaim(claim)
  const patientName = patientNameForClaim(claim)
  return claim.lines.map((l) => ({
    id: `charge:${l.id}`,
    type: 'charge' as const,
    claimControlNumber: claim.controlNumber,
    claimLineId: l.id,
    cptHcpcs: l.cptHcpcs,
    dateOfService: claim.dateOfService,
    accountKey,
    patientName,
    payerName: claim.payer.name,
    insuranceDeltaCents: l.billedCents,
    patientDeltaCents: 0,
    source: '837' as const,
    memo: `Charge ${l.cptHcpcs} — billed ${formatCents(l.billedCents)}`,
    postedAt,
  }))
}

/**
 * Payment posting from a remittance. The claim is optional but, when supplied,
 * lets us attach the canonical claim line id and patient account. Per 835 line:
 * an insurance payment, contractual / payer adjustments, and a transfer of any
 * patient-responsibility amount into the patient bucket.
 */
export function postRemittance(
  remit: Remittance,
  claim?: Claim,
  postedAt: string = new Date().toISOString(),
): LedgerEntry[] {
  const accountKey = claim ? accountKeyForClaim(claim) : remit.claimControlNumber
  const patientName = claim ? patientNameForClaim(claim) : undefined
  const payerName = remit.payer.name || claim?.payer.name || ''
  const dateOfService = claim?.dateOfService

  const claimLineByKey = new Map<string, string>()
  if (claim) for (const cl of claim.lines) claimLineByKey.set(lineKey(cl.cptHcpcs, cl.modifiers), cl.id)

  const entries: LedgerEntry[] = []
  remit.lines.forEach((rl, i) => {
    const claimLineId = claimLineByKey.get(lineKey(rl.cptHcpcs, rl.modifiers))
    const base = {
      claimControlNumber: remit.claimControlNumber,
      claimLineId,
      cptHcpcs: rl.cptHcpcs,
      dateOfService,
      accountKey,
      patientName,
      payerName,
      postedAt,
    }

    if (rl.paidCents > 0) {
      entries.push({
        ...base,
        id: `pay:${remit.claimControlNumber}:${i}`,
        type: 'insurance_payment',
        insuranceDeltaCents: -rl.paidCents,
        patientDeltaCents: 0,
        source: '835',
        memo: `Insurance paid ${formatCents(rl.paidCents)} on ${rl.cptHcpcs}`,
      })
    }

    rl.adjustments.forEach((a, j) => {
      if (a.amountCents === 0) return
      if (a.groupCode === 'PR') {
        entries.push({
          ...base,
          id: `pr:${remit.claimControlNumber}:${i}:${j}`,
          type: 'patient_responsibility',
          insuranceDeltaCents: -a.amountCents,
          patientDeltaCents: a.amountCents,
          source: '835',
          carcCode: a.carcCode,
          memo: `Patient responsibility ${formatCents(a.amountCents)} — ${patientRespLabel(a.carcCode)}`,
        })
      } else if (a.groupCode === 'CO') {
        entries.push({
          ...base,
          id: `co:${remit.claimControlNumber}:${i}:${j}`,
          type: 'contractual_adjustment',
          insuranceDeltaCents: -a.amountCents,
          patientDeltaCents: 0,
          source: '835',
          carcCode: a.carcCode,
          memo: `Contractual adjustment ${formatCents(a.amountCents)} (CARC ${a.carcCode}) — written off`,
        })
      } else {
        entries.push({
          ...base,
          id: `oa:${remit.claimControlNumber}:${i}:${j}`,
          type: 'payer_adjustment',
          insuranceDeltaCents: -a.amountCents,
          patientDeltaCents: 0,
          source: '835',
          carcCode: a.carcCode,
          memo: `Payer adjustment ${formatCents(a.amountCents)} (${a.groupCode} ${a.carcCode})`,
        })
      }
    })
  })
  return entries
}

/** A recorded patient payment — draws down the patient bucket. */
export function postPatientPayment(p: PatientPayment, postedAt: string = new Date().toISOString()): LedgerEntry {
  const accountKey = p.accountKey || p.claimControlNumber || 'unknown'
  const when = p.postedAt ?? postedAt
  return {
    id: p.id ?? `ptpay:${accountKey}:${p.amountCents}:${when}`,
    type: 'patient_payment',
    claimControlNumber: p.claimControlNumber ?? '',
    accountKey,
    patientName: p.patientName,
    insuranceDeltaCents: 0,
    patientDeltaCents: -p.amountCents,
    source: 'manual',
    memo: `Patient payment ${formatCents(p.amountCents)}${p.method ? ` (${p.method})` : ''}`,
    postedAt: when,
  }
}
