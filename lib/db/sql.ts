import { Pool, type PoolClient } from 'pg'
import { assertIsolationEnforced } from './isolation'

/**
 * Neon (Postgres) data-plane connection — the cheap HIPAA home for PHI, replacing
 * the Supabase JS client for DATA. Supabase stays for AUTH only: it identifies the
 * user; we resolve their tenant and run queries with a per-request GUC
 * (`app.current_tenant`) so the RLS policies (005/009/014) enforce isolation on
 * Neon exactly as they did on Supabase (see db/neon/zzz_rls_guc.sql).
 *
 * Two contexts, both transaction-scoped so nothing leaks across a pooled
 * connection:
 *   withTenant(id)  — app.current_tenant = id; the tenant policies apply.
 *   withService()   — app.role = 'service'; the <table>_service policies apply
 *                     (tenant bootstrap, the sync's tenant lookup, the corpus).
 * Since migration 014 forces RLS on every table, a query outside either context
 * sees nothing and writes nothing — even for the table owner.
 *
 * With real PHI allowed, the first transaction in the process verifies that the
 * database really enforces isolation (lib/db/isolation.ts) and refuses otherwise.
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
      // Neon requires TLS. The certificate chain is verified by default;
      // PG_SSL_STRICT=false relaxes that for an endpoint whose certificate does
      // not chain — never with real PHI (the compliance gate refuses the pair).
      ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.PG_SSL_STRICT !== 'false' } : undefined,
    })
  }
  return pool
}

// Verified once per process when real PHI is allowed; a failure is retried on
// the next call (the fix is a migration or a role change, not a restart).
let isolationVerified: Promise<void> | null = null
function verifyIsolation(client: Queryable): Promise<void> {
  if (process.env.ALLOW_REAL_PHI !== 'true') return Promise.resolve()
  if (!isolationVerified) {
    isolationVerified = assertIsolationEnforced(client).then(
      () => undefined,
      (e) => {
        isolationVerified = null
        throw e
      },
    )
  }
  return isolationVerified
}
/** Forget a previous verification (tests, the check script). */
export function resetIsolationVerification(): void {
  isolationVerified = null
}

/**
 * Run `fn` in a transaction with the tenant GUC set, so RLS scopes every statement
 * to this tenant. Repos ALSO pass tenant_id explicitly — belt and suspenders.
 */
export async function withTenant<T>(tenantId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await verifyIsolation(client)
    await client.query('begin')
    await client.query("select set_config('app.role', '', true)")
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

/**
 * A transaction in the service context — outside any tenant scope: membership
 * lookup, tenant bootstrap, the sync's tenant resolution, the de-id corpus.
 */
export async function withService<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await verifyIsolation(client)
    await client.query('begin')
    await client.query("select set_config('app.role', 'service', true)")
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
