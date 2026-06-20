/**
 * Apply the schema to Neon (DATABASE_URL). Order:
 *   1. db/neon/000_compat.sql        — Supabase-ism shim (roles + auth schema)
 *   2. supabase/migrations/*.sql     — the real schema + RLS, in numeric order
 *   3. db/neon/zzz_rls_guc.sql       — repoint current_tenant_id() at the GUC
 *
 * The migrations use `create table if not exists` etc., so re-runs are safe.
 * Run:  DATABASE_URL=postgres://… npm run db:migrate
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { getPool, closePool } from '../lib/db/sql'
import { loadEnvLocal } from './load-env-local'

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
  if (process.argv.includes('--reset')) {
    // Clean slate — drop everything so non-idempotent statements (CREATE POLICY)
    // re-apply. Safe for a fresh/test database; it deletes ALL data in public + auth.
    process.stdout.write('-- reset: dropping schema public + auth (clean slate) … ')
    await pool.query('drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;')
    console.log('ok')
  }
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
