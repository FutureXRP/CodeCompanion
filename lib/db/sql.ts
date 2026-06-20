import { Pool, type PoolClient } from 'pg'

/**
 * Neon (Postgres) data-plane connection — the cheap HIPAA home for PHI, replacing
 * the Supabase JS client for DATA. Supabase stays for AUTH only: it identifies the
 * user; we resolve their tenant and run queries with a per-request GUC
 * (`app.current_tenant`) so the existing RLS policies (005/009) enforce isolation
 * on Neon exactly as they did on Supabase (see db/neon/zzz_rls_guc.sql).
 *
 * Repos accept a `Queryable`, so they are unit-testable with pg / pg-mem without a
 * live database — and the same code runs against the real pool in production.
 */

/** The minimal surface a repo needs — satisfied by Pool, PoolClient, and pg-mem. */
export type Queryable = Pick<PoolClient, 'query'>

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set — a Neon Postgres connection string is required.')
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX ?? 5),
      // Neon requires TLS. Verify the chain unless explicitly relaxed (some pooled
      // endpoints present a cert the default store does not chain to).
      ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.PG_SSL_STRICT === 'true' } : undefined,
    })
  }
  return pool
}

/**
 * Run `fn` in a transaction with the tenant GUC set, so RLS scopes every statement
 * to this tenant. Repos ALSO pass tenant_id explicitly — belt and suspenders, and
 * the single-tenant active guard until a non-owner role + FORCE RLS is enabled.
 */
export async function withTenant<T>(tenantId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    await client.query('select set_config($1, $2, true)', ['app.current_tenant', tenantId])
    const out = await fn(client)
    await client.query('commit')
    return out
  } catch (err) {
    try { await client.query('rollback') } catch { /* already failing */ }
    throw err
  } finally {
    client.release()
  }
}

/** A query outside any tenant scope — the service path: membership lookup, tenant bootstrap, de-id corpus. */
export async function withService<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
