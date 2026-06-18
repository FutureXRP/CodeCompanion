import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Tenant bootstrap. Resolves the authenticated user's tenant, creating one (and
 * the tenant_users membership) on first sign-in. Must run with the service
 * client: tenant_users has no INSERT policy, so only the RLS-bypassing service
 * role can establish the very first membership.
 */
export async function ensureTenantForUser(
  db: SupabaseClient,
  userId: string,
  practiceName: string,
): Promise<string> {
  const existing = await db.from('tenant_users').select('tenant_id').eq('user_id', userId).limit(1).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data.tenant_id as string

  const tenant = await db.from('tenants').insert({ name: practiceName }).select('id').single()
  if (tenant.error) throw tenant.error
  const tenantId = tenant.data.id as string

  const link = await db.from('tenant_users').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' })
  if (link.error) throw link.error

  return tenantId
}
