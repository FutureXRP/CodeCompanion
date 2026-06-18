import type { Claim, Remittance } from '../canonical'
import { buildLedger } from './index'
import type { LedgerResult, PatientPayment } from './types'

/**
 * A fully-synthetic patient ledger for the dashboard demo and tests — no PHI.
 * Built by running the REAL posting engine over synthetic canonical claims +
 * remittances + a patient payment, so it exercises the same code path a live
 * 835 would. Three accounts, one per ledger state:
 *   - SETTLED      payer paid, contractual write-off, nothing owed
 *   - PATIENT OWES coinsurance transferred to the patient, partially paid
 *   - AWAITING     837 sent, no 835 back yet — outstanding from the payer
 */

function claim(controlNumber: string, member: string, first: string, last: string, dos: string, lines: { cpt: string; cents: number }[]): Claim {
  return {
    controlNumber,
    payer: { externalId: 'DEMO', name: 'Demo Health Plan' },
    diagnoses: ['E1165', 'I10'],
    dateOfService: dos,
    placeOfService: '11',
    totalBilledCents: lines.reduce((s, l) => s + l.cents, 0),
    sourceAdapter: 'edi',
    subscriber: { memberId: member, firstName: first, lastName: last },
    claimFrequencyCode: '1',
    lines: lines.map((l, i) => ({
      id: `${controlNumber}:${i + 1}`,
      lineNumber: i + 1,
      cptHcpcs: l.cpt,
      modifiers: [],
      units: 1,
      diagnosisPointers: [1],
      billedCents: l.cents,
    })),
  }
}

const SETTLED = claim('LEDGER001', 'MBRA100', 'AVERY', 'RIVERA', '2026-02-03', [{ cpt: '99214', cents: 17500 }])
const PATIENT_OWES = claim('LEDGER002', 'MBRB200', 'JORDAN', 'PARK', '2026-02-10', [
  { cpt: '99214', cents: 17500 },
  { cpt: '36415', cents: 2500 },
])
const AWAITING = claim('LEDGER003', 'MBRC300', 'CASEY', 'OKAFOR', '2026-02-18', [{ cpt: '99213', cents: 11000 }])

const SETTLED_REMIT: Remittance = {
  claimControlNumber: 'LEDGER001',
  payerClaimControlNumber: 'PCNA1',
  payer: { externalId: 'DEMO', name: 'Demo Health Plan' },
  claimStatusCode: '1',
  totalBilledCents: 17500,
  totalPaidCents: 15000,
  patientRespCents: 0,
  lines: [
    {
      cptHcpcs: '99214',
      modifiers: [],
      units: 1,
      billedCents: 17500,
      paidCents: 15000,
      allowedCents: 15000,
      patientRespCents: 0,
      adjustments: [{ groupCode: 'CO', carcCode: '45', amountCents: 2500 }],
    },
  ],
}

// 99214: allowed 150, paid 120, coinsurance (PR-2) 30. 36415: allowed 20, paid 20.
const PATIENT_OWES_REMIT: Remittance = {
  claimControlNumber: 'LEDGER002',
  payerClaimControlNumber: 'PCNB2',
  payer: { externalId: 'DEMO', name: 'Demo Health Plan' },
  claimStatusCode: '1',
  totalBilledCents: 20000,
  totalPaidCents: 14000,
  patientRespCents: 3000,
  lines: [
    {
      cptHcpcs: '99214',
      modifiers: [],
      units: 1,
      billedCents: 17500,
      paidCents: 12000,
      allowedCents: 15000,
      patientRespCents: 3000,
      adjustments: [
        { groupCode: 'CO', carcCode: '45', amountCents: 2500 },
        { groupCode: 'PR', carcCode: '2', amountCents: 3000 },
      ],
    },
    {
      cptHcpcs: '36415',
      modifiers: [],
      units: 1,
      billedCents: 2500,
      paidCents: 2000,
      allowedCents: 2000,
      patientRespCents: 0,
      adjustments: [{ groupCode: 'CO', carcCode: '45', amountCents: 500 }],
    },
  ],
}

// Patient paid $10 of the $30 coinsurance — $20 still owed.
const PATIENT_PAYMENT: PatientPayment = {
  id: 'demo-ptpay-1',
  claimControlNumber: 'LEDGER002',
  amountCents: 1000,
  method: 'card',
  postedAt: '2026-03-01T00:00:00.000Z',
}

/** The synthetic demo ledger, posted through the real engine. */
export function sampleLedger(postedAt = '2026-02-28T00:00:00.000Z'): LedgerResult {
  return buildLedger(
    {
      claims: [SETTLED, PATIENT_OWES, AWAITING],
      remittances: [SETTLED_REMIT, PATIENT_OWES_REMIT],
      payments: [PATIENT_PAYMENT],
    },
    postedAt,
  )
}
