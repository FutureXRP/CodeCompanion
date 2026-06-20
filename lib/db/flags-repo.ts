import type { SupabaseClient } from '@supabase/supabase-js'
import { writeAudit } from './audit'

/**
 * Feature-flag persistence (per-tenant module on/off). The durable production
 * store behind the Admin panel; the cookie is the zero-infra runtime store.
 */

export async function loadFeatureFlags(db: SupabaseClient, tenantId: string): Promise<Record<string, boolean>> {
  const res = await db.from('feature_flags').select('module_id, enabled').eq('tenant_id', tenantId)
  if (res.error) throw res.error
  const out: Record<string, boolean> = {}
  for (const r of (res.data ?? []) as { module_id: string; enabled: boolean }[]) out[r.module_id] = r.enabled
  return out
}

export async function setFeatureFlags(
  db: SupabaseClient,
  tenantId: string,
  userId: string | null,
  flags: Record<string, boolean>,
): Promise<void> {
  const rows = Object.entries(flags).map(([module_id, enabled]) => ({ tenant_id: tenantId, module_id, enabled, updated_at: new Date().toISOString() }))
  if (rows.length === 0) return
  const ins = await db.from('feature_flags').upsert(rows, { onConflict: 'tenant_id,module_id' })
  if (ins.error) throw ins.error
  await writeAudit(db, tenantId, userId, { action: 'write', resource: 'feature_flags', detail: { modules: rows.length } })
}
