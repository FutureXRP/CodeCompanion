import { type Queryable, jsonb } from './sql'

/**
 * Audit logging — the COMPLIANCE.md requirement that every PHI access is recorded:
 * who, what, when. Writes to the append-only audit_log table (009_operational.sql),
 * which a DB trigger makes immutable. PHI minimization: the detail jsonb carries
 * counts/ids, never raw patient data (no names, no member ids in cleartext).
 *
 * Audit failure is not swallowed — if we cannot record the access, the caller
 * should treat the operation as failed rather than proceed un-audited.
 */

export type AuditAction = 'read' | 'write' | 'export' | 'payment' | 'submit' | 'eligibility' | 'enroll'

export interface AuditEvent {
  action: AuditAction
  /** The table/domain touched, e.g. 'findings', 'payment_transactions', 'ledger_entries'. */
  resource: string
  resourceId?: string
  /** Non-PHI context only — counts, types, ids. Never names/member-ids/free text. */
  detail?: Record<string, unknown>
}

export async function writeAudit(
  db: Queryable,
  tenantId: string,
  userId: string | null,
  event: AuditEvent,
): Promise<void> {
  await db.query(
    `insert into audit_log (tenant_id, user_id, action, resource, resource_id, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [tenantId, userId, event.action, event.resource, event.resourceId ?? null, jsonb(event.detail)],
  )
}
