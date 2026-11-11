import { postPatientPayment } from '../ledger'
import { toPatientPayment, type PaymentRequest, type PaymentResult } from '../payments'
import type { EnrollmentRecord } from '../rcm/enrollment'
import type { EligibilityResult } from '../rcm/eligibility'
import type { PersistableTask, Task, TaskStatus } from '../tasks'
import { toLedgerEntryRow } from './mappers'
import { toEligibilityCheckRow, toEnrollmentRow, toPaymentTransactionRow, toTaskRow } from './operational-mappers'
import { writeAudit } from './audit'
import { type Queryable, insertReturning, insertMany, upsertMany } from './sql'

/**
 * Persistence for the operational modules (Neon / Postgres). Every PHI write is
 * paired with an audit-log entry (COMPLIANCE.md). Takes a Queryable. Money stays
 * integer cents.
 */

/** Record a patient payment: the processor record + the ledger posting + an audit row. */
export async function recordPayment(
  db: Queryable,
  tenantId: string,
  userId: string | null,
  claimId: string | null,
  req: PaymentRequest,
  result: PaymentResult,
): Promise<{ paymentTransactionId: string }> {
  const txn = await insertReturning(db, 'payment_transactions', toPaymentTransactionRow(tenantId, claimId, req, result), 'id')

  // A successful charge draws down patient A/R via an append-only ledger entry.
  if (result.ok) {
    const entry = postPatientPayment({ ...toPatientPayment(req, result), accountKey: req.accountKey })
    await insertMany(db, 'ledger_entries', [toLedgerEntryRow(tenantId, claimId, null, entry)])
  }

  await writeAudit(db, tenantId, userId, {
    action: 'payment',
    resource: 'payment_transactions',
    resourceId: txn.id as string,
    detail: { amountCents: req.amountCents, method: req.method, provider: result.provider, posted: result.ok },
  })
  return { paymentTransactionId: txn.id as string }
}

/** Upsert an enrollment record (provider × payer × transaction state). */
export async function upsertEnrollment(db: Queryable, tenantId: string, rec: EnrollmentRecord): Promise<void> {
  await upsertMany(
    db,
    'transaction_enrollments',
    [toEnrollmentRow(tenantId, rec)],
    ['tenant_id', 'provider_npi', 'payer_external_id', 'clearinghouse', 'transaction'],
  )
}

interface EnrollmentRowRead {
  provider_npi: string
  payer_external_id: string
  clearinghouse: EnrollmentRecord['clearinghouse']
  transaction: EnrollmentRecord['transaction']
  state: EnrollmentRecord['state']
  effective_date: string | null
  note: string | null
}

/** Load a tenant's enrollments, ready to seed an EnrollmentRegistry. */
export async function loadEnrollments(db: Queryable, tenantId: string): Promise<EnrollmentRecord[]> {
  const res = await db.query(
    'select provider_npi, payer_external_id, clearinghouse, transaction, state, effective_date, note from transaction_enrollments where tenant_id = $1',
    [tenantId],
  )
  return (res.rows as EnrollmentRowRead[]).map((r) => ({
    providerNpi: r.provider_npi,
    payerExternalId: r.payer_external_id,
    clearinghouse: r.clearinghouse,
    transaction: r.transaction,
    state: r.state,
    effectiveDate: r.effective_date ?? undefined,
    note: r.note ?? undefined,
  }))
}

/** Record an eligibility (270/271) result + an audit row. */
export async function recordEligibilityCheck(
  db: Queryable,
  tenantId: string,
  userId: string | null,
  payerId: string | null,
  result: EligibilityResult,
  source: 'mock' | 'stedi',
): Promise<string> {
  const ins = await insertReturning(db, 'eligibility_checks', toEligibilityCheckRow(tenantId, payerId, result, source), 'id')
  await writeAudit(db, tenantId, userId, {
    action: 'eligibility',
    resource: 'eligibility_checks',
    resourceId: ins.id as string,
    detail: { status: result.status },
  })
  return ins.id as string
}

const MS_PER_DAY = 86_400_000
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Persist a generated task queue (with concrete due dates derived from the SLA). */
export async function saveTasks(db: Queryable, tenantId: string, tasks: Task[], asOf: Date = new Date()): Promise<number> {
  if (tasks.length === 0) return 0
  const rows = tasks.map((t) => toTaskRow(tenantId, t, isoDate(new Date(asOf.getTime() + t.dueInDays * MS_PER_DAY))))
  await insertMany(db, 'tasks', rows)
  return rows.length
}

/**
 * Upsert engine-generated tasks by source_key (012). The engine refreshes title,
 * detail, dollars and priority; a human's assignee, status and due date survive.
 */
export async function upsertTasks(db: Queryable, tenantId: string, tasks: PersistableTask[], asOf: Date = new Date()): Promise<number> {
  if (tasks.length === 0) return 0
  const rows = tasks.map((t) => toTaskRow(tenantId, t, isoDate(new Date(asOf.getTime() + t.dueInDays * MS_PER_DAY)), t.sourceKey))
  await upsertMany(db, 'tasks', rows, ['tenant_id', 'source_key'], ['title', 'detail', 'dollars_cents', 'priority'])
  return rows.length
}

/**
 * Close engine tasks that no longer apply: for the claims this sync evaluated,
 * any keyed task whose key is not in the present set is done (the denial got
 * paid, the secondary got billed, the encounter got approved).
 */
export async function closeStaleTasks(db: Queryable, tenantId: string, controlNumbers: string[], presentKeys: string[]): Promise<number> {
  if (controlNumbers.length === 0) return 0
  const cph = controlNumbers.map((_, i) => `$${i + 2}`).join(', ')
  const kph = presentKeys.map((_, i) => `$${i + 2 + controlNumbers.length}`).join(', ')
  const res = await db.query(
    `update tasks set status = 'done', updated_at = now()
      where tenant_id = $1 and source_key is not null and status <> 'done'
        and split_part(source_key, ':', 2) in (${cph})${presentKeys.length ? ` and source_key not in (${kph})` : ''}`,
    [tenantId, ...controlNumbers, ...presentKeys],
  )
  return res.rowCount ?? 0
}

/** A human's edit: status and/or assignee. */
export async function updateTask(db: Queryable, tenantId: string, id: string, patch: { status?: TaskStatus; assignee?: string | null }): Promise<boolean> {
  const sets: string[] = []
  const params: unknown[] = [tenantId, id]
  if (patch.status) {
    params.push(patch.status)
    sets.push(`status = $${params.length}`)
  }
  if (patch.assignee !== undefined) {
    params.push(patch.assignee)
    sets.push(`assignee = $${params.length}`)
  }
  if (sets.length === 0) return false
  const res = await db.query(`update tasks set ${sets.join(', ')}, updated_at = now() where tenant_id = $1 and id = $2`, params)
  return (res.rowCount ?? 0) > 0
}

export interface StoredTask {
  id: string
  source: Task['source']
  sourceKey: string | null
  title: string
  detail: string | null
  dollarsCents: number
  assignee: string | null
  status: Task['status']
  priority: Task['priority']
  dueDate: string | null
  createdAt: string | null
}

interface TaskRowRead {
  id: string
  source: Task['source']
  source_key: string | null
  title: string
  detail: string | null
  dollars_cents: number | string
  assignee: string | null
  status: Task['status']
  priority: Task['priority']
  due_date: string | Date | null
  created_at: string | Date | null
}

const toIso = (v: string | Date | null): string | null => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

/** Load a tenant's tasks, highest dollars first. */
export async function loadTasks(db: Queryable, tenantId: string): Promise<StoredTask[]> {
  const res = await db.query(
    'select id, source, source_key, title, detail, dollars_cents, assignee, status, priority, due_date, created_at from tasks where tenant_id = $1 order by dollars_cents desc',
    [tenantId],
  )
  return (res.rows as TaskRowRead[]).map((r) => ({
    id: r.id,
    source: r.source,
    sourceKey: r.source_key ?? null,
    title: r.title,
    detail: r.detail,
    dollarsCents: Number(r.dollars_cents) || 0,
    assignee: r.assignee,
    status: r.status,
    priority: r.priority,
    dueDate: toIso(r.due_date),
    createdAt: toIso(r.created_at),
  }))
}
