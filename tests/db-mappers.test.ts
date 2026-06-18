import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Claim, Finding } from '../lib/canonical'
import {
  toClaimRow,
  toClaimLineRow,
  toFindingRow,
  toRemittanceLineRow,
  toAdjustmentRow,
  lineMatchKey,
} from '../lib/db/mappers'

test('toClaimRow maps a canonical claim to a tenant-scoped row (integer cents)', () => {
  const claim: Claim = {
    controlNumber: 'PATIENT001',
    payer: { externalId: '00123', name: 'Medicare' },
    diagnoses: ['E1165'],
    totalBilledCents: 17500,
    sourceAdapter: 'edi',
    lines: [],
  }
  const row = toClaimRow('tenant-1', 'payer-1', claim)
  assert.equal(row.tenant_id, 'tenant-1')
  assert.equal(row.payer_id, 'payer-1')
  assert.equal(row.control_number, 'PATIENT001')
  assert.equal(row.total_billed_cents, 17500)
  assert.equal(row.source_adapter, 'edi')
})

test('toClaimLineRow preserves modifiers, units, and diagnosis pointers', () => {
  const row = toClaimLineRow('claim-1', {
    id: 'PATIENT001:1', lineNumber: 1, cptHcpcs: '99214', modifiers: ['25'], units: 1, diagnosisPointers: [1, 2], billedCents: 15000,
  })
  assert.equal(row.claim_id, 'claim-1')
  assert.equal(row.line_number, 1)
  assert.equal(row.cpt_hcpcs, '99214')
  assert.deepEqual(row.modifiers, ['25'])
  assert.deepEqual(row.dx_pointers, [1, 2])
  assert.equal(row.billed_cents, 15000)
})

test('toFindingRow stores delta + status and omits the derived recoverable figure', () => {
  const f: Finding = {
    id: 'denial:PATIENT002:1', type: 'denial', claimControlNumber: 'PATIENT002', claimLineId: 'PATIENT002:1',
    payerName: 'Medicare', payerExternalId: '00123', cptHcpcs: '99215', modifiers: [],
    expectedCents: 16000, actualCents: 0, deltaCents: 16000, recoverableCents: 16000,
    appealable: true, status: 'open', reason: 'CARC 197 — authorization absent', detectedAt: '2026-06-18T00:00:00Z',
  }
  const row = toFindingRow('tenant-1', 'line-9', f)
  assert.equal(row.tenant_id, 'tenant-1')
  assert.equal(row.claim_line_id, 'line-9')
  assert.equal(row.type, 'denial')
  assert.equal(row.delta_cents, 16000)
  assert.equal(row.appealable, true)
  assert.equal(row.status, 'open')
  assert.equal('recoverable_cents' in row, false) // findings table has no recoverable_cents column
})

test('toRemittanceLineRow + toAdjustmentRow map the 835 side', () => {
  const rl = toRemittanceLineRow('remit-1', 'line-1', {
    cptHcpcs: '99214', modifiers: [], units: 1, billedCents: 15000, paidCents: 10850, allowedCents: 11500, patientRespCents: 0, adjustments: [],
  })
  assert.equal(rl.remittance_id, 'remit-1')
  assert.equal(rl.claim_line_id, 'line-1')
  assert.equal(rl.paid_cents, 10850)
  assert.equal(rl.allowed_cents, 11500)

  const adj = toAdjustmentRow('rl-1', { groupCode: 'CO', carcCode: '45', amountCents: 4150 })
  assert.equal(adj.group_code, 'CO')
  assert.equal(adj.carc_code, '45')
  assert.equal(adj.rarc_code, null)
  assert.equal(adj.amount_cents, 4150)
})

test('lineMatchKey is modifier-order independent', () => {
  assert.equal(lineMatchKey('99214', ['25', '59']), lineMatchKey('99214', ['59', '25']))
  assert.notEqual(lineMatchKey('99214', []), lineMatchKey('99215', []))
})
