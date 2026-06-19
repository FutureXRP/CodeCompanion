import type { EligibilityResult } from '../rcm/eligibility'
import type { EnrollmentRecord } from '../rcm/enrollment'
import type { PaymentRequest, PaymentResult } from '../payments'
import type { Task } from '../tasks'

/**
 * Pure canonical/domain -> Supabase row mappers for the operational modules
 * (009_operational.sql). No DB access, so they are fully unit-tested. Money stays
 * integer cents; column names match the migration exactly.
 */

export interface EligibilityCheckRow {
  tenant_id: string
  payer_id: string | null
  account_key: string
  status: EligibilityResult['status']
  copay_cents: number | null
  coinsurance_pct: number | null
  deductible_cents: number | null
  deductible_remaining_cents: number | null
  out_of_pocket_cents: number | null
  out_of_pocket_remaining_cents: number | null
  plan_name: string | null
  source: 'mock' | 'stedi'
}
export function toEligibilityCheckRow(
  tenantId: string,
  payerId: string | null,
  result: EligibilityResult,
  source: 'mock' | 'stedi',
): EligibilityCheckRow {
  return {
    tenant_id: tenantId,
    payer_id: payerId,
    account_key: result.member.memberId,
    status: result.status,
    copay_cents: result.copayCents ?? null,
    coinsurance_pct: result.coinsurancePercent ?? null,
    deductible_cents: result.deductibleCents ?? null,
    deductible_remaining_cents: result.deductibleRemainingCents ?? null,
    out_of_pocket_cents: result.outOfPocketCents ?? null,
    out_of_pocket_remaining_cents: result.outOfPocketRemainingCents ?? null,
    plan_name: result.planName ?? null,
    source,
  }
}

export interface EnrollmentRow {
  tenant_id: string
  provider_npi: string
  payer_external_id: string
  clearinghouse: EnrollmentRecord['clearinghouse']
  transaction: EnrollmentRecord['transaction']
  state: EnrollmentRecord['state']
  effective_date: string | null
  note: string | null
}
export function toEnrollmentRow(tenantId: string, rec: EnrollmentRecord): EnrollmentRow {
  return {
    tenant_id: tenantId,
    provider_npi: rec.providerNpi,
    payer_external_id: rec.payerExternalId,
    clearinghouse: rec.clearinghouse,
    transaction: rec.transaction,
    state: rec.state,
    effective_date: rec.effectiveDate ?? null,
    note: rec.note ?? null,
  }
}

export interface PaymentTransactionRow {
  tenant_id: string
  claim_id: string | null
  account_key: string
  amount_cents: number
  method: PaymentRequest['method']
  provider: PaymentResult['provider']
  external_transaction_id: string | null
  status: 'succeeded' | 'failed' | 'pending'
}
export function toPaymentTransactionRow(
  tenantId: string,
  claimId: string | null,
  req: PaymentRequest,
  result: PaymentResult,
): PaymentTransactionRow {
  return {
    tenant_id: tenantId,
    claim_id: claimId,
    account_key: req.accountKey,
    amount_cents: req.amountCents,
    method: req.method,
    provider: result.provider,
    external_transaction_id: result.transactionId ?? null,
    status: result.ok ? 'succeeded' : 'failed',
  }
}

export interface TaskRow {
  tenant_id: string
  source: Task['source']
  title: string
  detail: string | null
  dollars_cents: number
  assignee: string | null
  status: Task['status']
  priority: Task['priority']
  due_date: string | null
}
export function toTaskRow(tenantId: string, t: Task, dueDate: string | null = null): TaskRow {
  return {
    tenant_id: tenantId,
    source: t.source,
    title: t.title,
    detail: t.detail,
    dollars_cents: t.dollarsCents,
    assignee: t.assignee,
    status: t.status,
    priority: t.priority,
    due_date: dueDate,
  }
}
