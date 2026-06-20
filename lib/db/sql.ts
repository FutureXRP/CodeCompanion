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

// ── Generic row helpers ──────────────────────────────────────────────────────
// The repos build snake_case row objects (via lib/db/mappers); these turn them
// into parameterized SQL. Column/table names are code-controlled (guarded by
// ident()); every value is a bound parameter.

type ResultRow = Record<string, unknown>
// Accept `object` (the mapper interfaces) and normalize internally — TS does not
// treat an interface as assignable to Record<string, unknown> (it could be merged).
const asRow = (o: object) => o as Record<string, unknown>

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`unsafe SQL identifier: ${name}`)
  return `"${name}"`
}
/** jsonb columns: pass a JSON string so both node-postgres and pg-mem store it cleanly. */
export function jsonb(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v)
}

/** INSERT one row, RETURNING the named columns (default `id`). */
export async function insertReturning(db: Queryable, table: string, row: object, returning = 'id'): Promise<ResultRow> {
  const r = asRow(row)
  const keys = Object.keys(r)
  const cols = keys.map(ident).join(', ')
  const ph = keys.map((_, i) => `$${i + 1}`).join(', ')
  const res = await db.query(`insert into ${ident(table)} (${cols}) values (${ph}) returning ${returning}`, keys.map((k) => r[k]))
  return res.rows[0] as ResultRow
}

/** Bulk INSERT (all rows share the first row's keys); optional RETURNING. */
export async function insertMany(db: Queryable, table: string, rows: object[], returning?: string): Promise<ResultRow[]> {
  if (rows.length === 0) return []
  const rs = rows.map(asRow)
  const keys = Object.keys(rs[0])
  const cols = keys.map(ident).join(', ')
  const values: unknown[] = []
  const tuples = rs.map((r, ri) => `(${keys.map((k, ki) => { values.push(r[k]); return `$${ri * keys.length + ki + 1}` }).join(', ')})`)
  const ret = returning ? ` returning ${returning}` : ''
  const res = await db.query(`insert into ${ident(table)} (${cols}) values ${tuples.join(', ')}${ret}`, values)
  return res.rows as ResultRow[]
}

/** Bulk UPSERT on `conflictCols`; updates `updateCols` (default: all non-conflict columns). */
export async function upsertMany(db: Queryable, table: string, rows: object[], conflictCols: string[], updateCols?: string[]): Promise<void> {
  if (rows.length === 0) return
  const rs = rows.map(asRow)
  const keys = Object.keys(rs[0])
  const cols = keys.map(ident).join(', ')
  const values: unknown[] = []
  const tuples = rs.map((r, ri) => `(${keys.map((k, ki) => { values.push(r[k]); return `$${ri * keys.length + ki + 1}` }).join(', ')})`)
  const upd = (updateCols ?? keys.filter((k) => !conflictCols.includes(k)))
  const action = upd.length ? `do update set ${upd.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}` : 'do nothing'
  await db.query(`insert into ${ident(table)} (${cols}) values ${tuples.join(', ')} on conflict (${conflictCols.map(ident).join(', ')}) ${action}`, values)
}
