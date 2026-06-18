import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim, Remittance } from '../lib/canonical'
import {
  buildLedger,
  buildStatement,
  computeBalance,
  postClaimCharges,
  postRemittance,
  standingFor,
} from '../lib/ledger'
import { sampleLedger } from '../lib/ledger/sample'
import { loadSampleClaims, loadSampleRemittances } from '../lib/adapters/edi'
import { toLedgerEntryRow } from '../lib/db/mappers'

const POSTED = '2026-03-01T00:00:00.000Z'

function claim(controlNumber: string, member: string, lines: { cpt: string; cents: number }[]): Claim {
  return {
    controlNumber,
    payer: { externalId: 'P', name: 'Test Payer' },
    diagnoses: ['E1165'],
    dateOfService: '2026-02-01',
    totalBilledCents: lines.reduce((s, l) => s + l.cents, 0),
    sourceAdapter: 'edi',
    subscriber: { memberId: member, firstName: 'PAT', lastName: 'PERSON' },
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

test('a charge with no remittance is fully outstanding from the payer', () => {
  const entries = postClaimCharges(claim('C1', 'M1', [{ cpt: '99213', cents: 11000 }]), POSTED)
  const b = computeBalance(entries)
  assert.equal(b.chargedCents, 11000)
  assert.equal(b.insuranceArCents, 11000)
  assert.equal(b.patientArCents, 0)
  assert.equal(b.totalBalanceCents, 11000)
  assert.equal(standingFor(b), 'awaiting_payer')
})

test('payer payment + contractual write-off settles the line to zero', () => {
  const c = claim('C2', 'M2', [{ cpt: '99214', cents: 17500 }])
  const remit: Remittance = {
    claimControlNumber: 'C2',
    payerClaimControlNumber: 'X',
    payer: { externalId: 'P', name: 'Test Payer' },
    claimStatusCode: '1',
    totalBilledCents: 17500,
    totalPaidCents: 15000,
    patientRespCents: 0,
    lines: [{ cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 17500, paidCents: 15000, allowedCents: 15000, patientRespCents: 0, adjustments: [{ groupCode: 'CO', carcCode: '45', amountCents: 2500 }] }],
  }
  const b = computeBalance([...postClaimCharges(c, POSTED), ...postRemittance(remit, c, POSTED)])
  assert.equal(b.insurancePaidCents, 15000)
  assert.equal(b.contractualAdjCents, 2500)
  assert.equal(b.insuranceArCents, 0)
  assert.equal(b.totalBalanceCents, 0)
  assert.equal(standingFor(b), 'settled')
})

test('a PR adjustment transfers the balance to the patient; a payment draws it down', () => {
  const ledger = buildLedger(
    {
      claims: [claim('C3', 'M3', [{ cpt: '99214', cents: 17500 }])],
      remittances: [
        {
          claimControlNumber: 'C3',
          payerClaimControlNumber: 'X',
          payer: { externalId: 'P', name: 'Test Payer' },
          claimStatusCode: '1',
          totalBilledCents: 17500,
          totalPaidCents: 12000,
          patientRespCents: 3000,
          lines: [{ cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 17500, paidCents: 12000, allowedCents: 15000, patientRespCents: 3000, adjustments: [
            { groupCode: 'CO', carcCode: '45', amountCents: 2500 },
            { groupCode: 'PR', carcCode: '2', amountCents: 3000 },
          ] }],
        },
      ],
      payments: [{ claimControlNumber: 'C3', amountCents: 1000, method: 'card' }],
    },
    POSTED,
  )
  assert.equal(ledger.accounts.length, 1)
  const b = ledger.accounts[0].balance
  assert.equal(b.insuranceArCents, 0) // payer fully accounted (paid + CO + PR)
  assert.equal(b.patientRespCents, 3000) // gross moved to patient
  assert.equal(b.patientPaidCents, 1000)
  assert.equal(b.patientArCents, 2000) // still owed by patient
  assert.equal(b.totalBalanceCents, 2000)
  assert.equal(ledger.accounts[0].standing, 'patient_owes')
})

test('a denied line nets to a $0 collectable balance (recovery is tracked in Found Money, not here)', () => {
  const c = claim('C4', 'M4', [{ cpt: '99215', cents: 21000 }])
  const remit: Remittance = {
    claimControlNumber: 'C4',
    payerClaimControlNumber: 'X',
    payer: { externalId: 'P', name: 'Test Payer' },
    claimStatusCode: '4',
    totalBilledCents: 21000,
    totalPaidCents: 0,
    patientRespCents: 0,
    lines: [{ cptHcpcs: '99215', modifiers: [], units: 1, billedCents: 21000, paidCents: 0, allowedCents: 0, patientRespCents: 0, adjustments: [{ groupCode: 'CO', carcCode: '197', amountCents: 21000 }] }],
  }
  const b = computeBalance([...postClaimCharges(c, POSTED), ...postRemittance(remit, c, POSTED)])
  assert.equal(b.insuranceArCents, 0)
  assert.equal(b.patientArCents, 0)
  assert.equal(b.totalBalanceCents, 0)
})

test('a voided claim (frequency 8) posts no charge', () => {
  const c = { ...claim('C5', 'M5', [{ cpt: '99214', cents: 17500 }]), claimFrequencyCode: '8' }
  assert.equal(postClaimCharges(c, POSTED).length, 0)
})

test('sampleLedger posts through the real engine to the expected balances', () => {
  const { accounts, totals } = sampleLedger()
  assert.equal(accounts.length, 3)
  // Grand totals: $110 awaiting payer + $20 patient = $130 outstanding.
  assert.equal(totals.chargedCents, 48500)
  assert.equal(totals.insurancePaidCents, 29000)
  assert.equal(totals.contractualAdjCents, 5500)
  assert.equal(totals.insuranceArCents, 11000)
  assert.equal(totals.patientArCents, 2000)
  assert.equal(totals.totalBalanceCents, 13000)
  // Ledger invariant: balance == charged - paid - all adjustments - patient paid.
  assert.equal(
    totals.totalBalanceCents,
    totals.chargedCents - totals.insurancePaidCents - totals.contractualAdjCents - totals.otherAdjCents - totals.patientPaidCents - totals.patientWriteoffCents,
  )
  // Sorted highest-balance first.
  assert.equal(accounts[0].standing, 'awaiting_payer')
})

test('a patient statement itemizes the bill and shows the net amount due', () => {
  const { accounts } = sampleLedger()
  const owed = accounts.find((a) => a.balance.patientArCents > 0)!
  const stmt = buildStatement(owed)
  assert.equal(stmt.patientName, 'JORDAN PARK')
  assert.equal(stmt.lines.length, 2)
  const office = stmt.lines.find((l) => l.cptHcpcs === '99214')!
  assert.equal(office.chargedCents, 17500)
  assert.equal(office.insurancePaidCents, 12000)
  assert.equal(office.adjustedCents, 2500)
  assert.equal(office.patientRespCents, 3000)
  assert.equal(stmt.amountDueCents, 2000) // $30 coinsurance less the $10 paid
})

test('posting the shared EDI sample groups under one subscriber, $110 outstanding', () => {
  const ledger = buildLedger({ claims: loadSampleClaims(), remittances: loadSampleRemittances() }, POSTED)
  assert.equal(ledger.accounts.length, 1) // sample uses a single subscriber loop
  assert.equal(ledger.totals.chargedCents, 67000)
  assert.equal(ledger.totals.patientArCents, 0) // sample has no PR
  assert.equal(ledger.totals.insuranceArCents, 11000) // PATIENT004: 837 sent, no 835
  assert.equal(ledger.totals.totalBalanceCents, 11000)
})

test('toLedgerEntryRow maps a ledger entry to a tenant-scoped row (integer cents)', () => {
  const [charge] = postClaimCharges(claim('C6', 'M6', [{ cpt: '99214', cents: 17500 }]), POSTED)
  const row = toLedgerEntryRow('tenant-1', 'claim-1', 'line-1', charge)
  assert.equal(row.tenant_id, 'tenant-1')
  assert.equal(row.claim_id, 'claim-1')
  assert.equal(row.claim_line_id, 'line-1')
  assert.equal(row.account_key, 'M6')
  assert.equal(row.type, 'charge')
  assert.equal(row.insurance_delta_cents, 17500)
  assert.equal(row.patient_delta_cents, 0)
  assert.equal(row.source, '837')
})
