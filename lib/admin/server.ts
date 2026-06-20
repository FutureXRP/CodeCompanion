import { cookies } from 'next/headers'
import { FLAGS_COOKIE, parseOverrides, resolveFlags, type FlagMap } from './flags'

/**
 * Server-side module-flag resolution. The cookie is the runtime store (works with
 * zero infra and persists per browser); in multi-tenant production the feature_flags
 * table is the durable per-tenant store and the API writes both.
 */
export { FLAGS_COOKIE }

export async function readModuleFlags(): Promise<FlagMap> {
  const store = await cookies()
  return resolveFlags(parseOverrides(store.get(FLAGS_COOKIE)?.value))
}
