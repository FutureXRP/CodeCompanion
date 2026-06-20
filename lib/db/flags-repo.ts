import { type Queryable, upsertMany } from './sql'
import { writeAudit } from './audit'

/**
 * Feature-flag persistence (per-tenant module on/off). The durable production
 * store behind the Admin panel; the cookie is the zero-infra runtime store.
 */

export async function loadFeatureFlags(db: Queryable, tenantId: string): Promise<Record<string, boolean>> {
  const res = await db.query('select module_id, enabled from feature_flags where tenant_id = $1', [tenantId])
  const out: Record<string, boolean> = {}
  for (const r of res.rows as { module_id: string; enabled: boolean }[]) out[r.module_id] = r.enabled
  return out
}

export async function setFeatureFlags(
  db: Queryable,
  tenantId: string,
  userId: string | null,
  flags: Record<string, boolean>,
): Promise<void> {
  const rows = Object.entries(flags).map(([module_id, enabled]) => ({
    tenant_id: tenantId,
    module_id,
    enabled,
    updated_at: new Date().toISOString(),
  }))
  if (rows.length === 0) return
  await upsertMany(db, 'feature_flags', rows, ['tenant_id', 'module_id'], ['enabled', 'updated_at'])
  await writeAudit(db, tenantId, userId, { action: 'write', resource: 'feature_flags', detail: { modules: rows.length } })
}
