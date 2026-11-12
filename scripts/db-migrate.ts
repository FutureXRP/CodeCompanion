/**
 * Apply the schema to Neon (MIGRATE_DATABASE_URL — the owner; else DATABASE_URL). Order:
 *   1. db/neon/000_compat.sql        — Supabase-ism shim (roles + auth schema)
 *   2. supabase/migrations/*.sql     — the real schema + RLS, in numeric order
 *   3. db/neon/zzz_rls_guc.sql       — repoint current_tenant_id() at the GUC
 *
 * Applied files are recorded in `schema_migrations`, so a plain run applies only
 * what is new — the one command a practice ever needs after setup:
 *
 *   npm run db:migrate                     apply every migration not yet recorded
 *   npm run db:migrate -- --baseline=010   a database set up BEFORE tracking: record
 *                                          000…010 (+ the shim files) as applied, run nothing
 *   npm run db:migrate -- --only=013       apply one file regardless (and record it)
 *   npm run db:reset                       drop everything and apply from scratch (test DBs)
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

export interface MigrateArgs {
  reset: boolean
  only?: string
  /** true = everything; a prefix such as "010" = files sorting at or before it (plus the shim files). */
  baseline?: string | true
}

export function parseArgs(argv: string[]): MigrateArgs {
  const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
  const b = argv.find((a) => a === '--baseline' || a.startsWith('--baseline='))
  return {
    reset: argv.includes('--reset'),
    only: only || undefined,
    baseline: b === undefined ? undefined : b === '--baseline' ? true : b.slice('--baseline='.length) || true,
  }
}

/** Which files to run (pure): --only wins; --reset runs all; otherwise everything not yet recorded. */
export function selectMigrations(all: string[], applied: Set<string>, args: MigrateArgs): string[] {
  if (args.only) {
    const hit = all.filter((f) => path.basename(f).includes(args.only!))
    if (hit.length === 0) throw new Error(`--only=${args.only} matched no migration file.`)
    return hit
  }
  if (args.reset) return all
  return all.filter((f) => !applied.has(path.basename(f)))
}

/** Files a baseline records as applied without running them. */
export function baselineFiles(all: string[], baseline: string | true): string[] {
  if (baseline === true) return all
  return all.filter((f) => {
    const b = path.basename(f)
    return b.startsWith('000_') || b.startsWith('zzz_') || b.startsWith(baseline) || b.localeCompare(baseline) < 0
  })
}

const TRACKING = 'create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())'

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const root = process.cwd()
  // Migrations run as the table owner (MIGRATE_DATABASE_URL); the app itself runs
  // as a member of codecompanion_app (DATABASE_URL) once migration 014 is applied.
  if (process.env.MIGRATE_DATABASE_URL) process.env.DATABASE_URL = process.env.MIGRATE_DATABASE_URL
  const pool = getPool()
  const all = migrationPaths(root)

  if (args.reset) {
    // Clean slate — drop everything so non-idempotent statements (CREATE POLICY)
    // re-apply. Safe for a fresh/test database; it deletes ALL data in public + auth.
    process.stdout.write('-- reset: dropping schema public + auth (clean slate) … ')
    await pool.query('drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;')
    console.log('ok')
  }
  await pool.query(TRACKING)

  if (args.baseline !== undefined) {
    const files = baselineFiles(all, args.baseline)
    for (const f of files) await pool.query('insert into schema_migrations (filename) values ($1) on conflict do nothing', [path.basename(f)])
    console.log(`-- baseline: recorded ${files.length} file(s) as already applied (nothing run).`)
    if (!args.only) {
      await closePool()
      return
    }
  }

  const applied = new Set((await pool.query('select filename from schema_migrations')).rows.map((r) => r.filename as string))
  const files = selectMigrations(all, applied, args)
  if (files.length === 0) console.log('Nothing to apply — every migration is recorded in schema_migrations.')
  for (const file of files) {
    const sql = readFileSync(file, 'utf8')
    process.stdout.write(`-- applying ${path.relative(root, file)} … `)
    await pool.query(sql) // node-postgres runs multi-statement SQL when there are no params
    await pool.query('insert into schema_migrations (filename) values ($1) on conflict do nothing', [path.basename(file)])
    console.log('ok')
  }
  await closePool()
  console.log(`Applied ${files.length} migration(s) to DATABASE_URL.`)
}

// Only run when invoked directly (so tests can import the pure helpers without connecting).
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'db-migrate.ts'))) {
  run().catch((e) => { console.error(e); process.exit(1) })
}
