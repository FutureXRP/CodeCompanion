/**
 * Supabase wiring is optional. Without env, the app runs in today's in-memory
 * demo mode; with it, persistence and (later) auth light up. These guards let
 * callers degrade gracefully instead of throwing on a missing key.
 */

/** Client-readable config (URL + anon key) — enough for auth + RLS reads. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/** Server-side ingestion (writing a run) needs the service-role key. */
export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Neon (Postgres) data plane — where PHI lives. Auth stays on Supabase. */
export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined
}

/** Single-practice bootstrap tenant until multi-user auth lands. */
export const DEFAULT_TENANT_NAME = 'My Practice'
