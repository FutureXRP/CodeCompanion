/**
 * Apply the schema to Neon (DATABASE_URL). Order:
 *   1. db/neon/000_compat.sql        — Supabase-ism shim (roles + auth schema)
 *   2. supabase/migrations/*.sql     — the real schema + RLS, in numeric order
 *   3. db/neon/zzz_rls_guc.sql       — repoint current_tenant_id() at the GUC
 *
 * The migrations use `create table if not exists` etc., so re-runs are safe.
 * Run:  DATABASE_URL=postgres://… npm run db:migrate
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { getPool, closePool } from '../lib/db/sql'

/**
 * Load .env.local (KEY=VALUE lines) for local / Codespaces runs. The Next.js app
 * reads .env.local automatically; standalone scripts do not, so this gives them the
 * same single source. Existing process.env wins (Cloud Run / CI), and we split on
 * the FIRST '=' so connection strings with '=' (…?sslmode=require) survive intact.
 */
function loadEnvLocal(file = path.join(process.cwd(), '.env.local')): void {
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (key && !(key in process.env)) process.env[key] = val
  }
}
loadEnvLocal()

/** The ordered list of SQL files to apply (pure — unit-tested). */
export function migrationPaths(root: string): string[] {
  const migDir = path.join(root, 'supabase', 'migrations')
  const numbered = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(migDir, f))
  return [
    path.join(root, 'db', 'neon', '000_compat.sql'),
    ...numbered,
    path.join(root, 'db', 'neon', 'zzz_rls_guc.sql'),
  ]
}

async function run(): Promise<void> {
  const root = process.cwd()
  const pool = getPool()
  for (const file of migrationPaths(root)) {
    const sql = readFileSync(file, 'utf8')
    process.stdout.write(`-- applying ${path.relative(root, file)} … `)
    await pool.query(sql) // node-postgres runs multi-statement SQL when there are no params
    console.log('ok')
  }
  await closePool()
  console.log('Schema applied to DATABASE_URL.')
}

// Only run when invoked directly (so tests can import migrationPaths without connecting).
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'db-migrate.ts'))) {
  run().catch((e) => { console.error(e); process.exit(1) })
}
