import type { Queryable } from './sql'

/**
 * Tenant bootstrap + resolution on Neon. Auth stays on Supabase: it identifies the
 * user; here we map that user id to a tenant. tenant_users FKs to auth.users (the
 * Neon compat shim provides a minimal auth.users), so we upsert the user first.
 * One tenant per user for now.
 */

/** Resolve the user's tenant, creating the tenant + membership on first call. */
export async function ensureTenantForUser(
  db: Queryable,
  userId: string,
  practiceName: string,
  email?: string | null,
): Promise<string> {
  await db.query('insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing', [userId, email ?? null])

  const existing = await db.query('select tenant_id from tenant_users where user_id = $1 limit 1', [userId])
  if (existing.rows[0]) return existing.rows[0].tenant_id as string

  const tenant = await db.query('insert into tenants (name) values ($1) returning id', [practiceName])
  const tenantId = tenant.rows[0].id as string
  await db.query('insert into tenant_users (tenant_id, user_id, role) values ($1, $2, $3)', [tenantId, userId, 'owner'])
  return tenantId
}

/** Read-only: the user's tenant id, or null if they have no membership yet. */
export async function resolveTenantId(db: Queryable, userId: string): Promise<string | null> {
  const res = await db.query('select tenant_id from tenant_users where user_id = $1 limit 1', [userId])
  return res.rows[0] ? (res.rows[0].tenant_id as string) : null
}

/** The practice (tenant) display name. */
export async function loadTenantName(db: Queryable, tenantId: string): Promise<string | null> {
  const res = await db.query('select name from tenants where id = $1 limit 1', [tenantId])
  return res.rows[0] ? (res.rows[0].name as string) : null
}
