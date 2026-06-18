import type { Adjustment, Claim, ClaimLine, Finding, RemittanceLine } from '../canonical'

/**
 * Pure canonical -> Supabase row mappers. No DB access here, so they are fully
 * unit-tested. Money stays integer cents end to end. Column names match
 * db/migrations/005_canonical_model.sql exactly.
 */

export interface ClaimRow {
  tenant_id: string
  payer_id: string | null
  control_number: string
  total_billed_cents: number
  source_adapter: Claim['sourceAdapter']
}
export function toClaimRow(tenantId: string, payerId: string | null, claim: Claim): ClaimRow {
  return {
    tenant_id: tenantId,
    payer_id: payerId,
    control_number: claim.controlNumber,
    total_billed_cents: claim.totalBilledCents,
    source_adapter: claim.sourceAdapter,
  }
}

export interface ClaimLineRow {
  claim_id: string
  line_number: number
  cpt_hcpcs: string
  modifiers: string[]
  units: number
  dx_pointers: number[]
  billed_cents: number
}
export function toClaimLineRow(claimId: string, line: ClaimLine): ClaimLineRow {
  return {
    claim_id: claimId,
    line_number: line.lineNumber,
    cpt_hcpcs: line.cptHcpcs,
    modifiers: line.modifiers,
    units: line.units,
    dx_pointers: line.diagnosisPointers,
    billed_cents: line.billedCents,
  }
}

export interface RemittanceRow {
  tenant_id: string
  claim_id: string | null
  payer_id: string | null
}
export function toRemittanceRow(tenantId: string, claimId: string | null, payerId: string | null): RemittanceRow {
  return { tenant_id: tenantId, claim_id: claimId, payer_id: payerId }
}

export interface RemittanceLineRow {
  remittance_id: string
  claim_line_id: string | null
  allowed_cents: number
  paid_cents: number
  patient_resp_cents: number
}
export function toRemittanceLineRow(remittanceId: string, claimLineId: string | null, line: RemittanceLine): RemittanceLineRow {
  return {
    remittance_id: remittanceId,
    claim_line_id: claimLineId,
    allowed_cents: line.allowedCents,
    paid_cents: line.paidCents,
    patient_resp_cents: line.patientRespCents,
  }
}

export interface AdjustmentRow {
  remittance_line_id: string
  group_code: string
  carc_code: string
  rarc_code: string | null
  amount_cents: number
}
export function toAdjustmentRow(remittanceLineId: string, adj: Adjustment): AdjustmentRow {
  return {
    remittance_line_id: remittanceLineId,
    group_code: adj.groupCode,
    carc_code: adj.carcCode,
    rarc_code: adj.rarcCode ?? null,
    amount_cents: adj.amountCents,
  }
}

export interface FindingRow {
  tenant_id: string
  claim_line_id: string | null
  type: Finding['type']
  expected_cents: number
  actual_cents: number
  delta_cents: number
  appealable: boolean
  status: Finding['status']
}
export function toFindingRow(tenantId: string, claimLineId: string | null, f: Finding): FindingRow {
  return {
    tenant_id: tenantId,
    claim_line_id: claimLineId,
    type: f.type,
    expected_cents: f.expectedCents,
    actual_cents: f.actualCents,
    delta_cents: f.deltaCents,
    appealable: f.appealable,
    status: f.status,
  }
}

/** Stable join key for matching a remittance line back to its claim line. */
export function lineMatchKey(cptHcpcs: string, modifiers: string[]): string {
  return `${cptHcpcs}|${[...modifiers].sort().join(',')}`
}
