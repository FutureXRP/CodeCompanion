import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newDb } from 'pg-mem'
import { migrationPaths } from '../scripts/db-migrate'

test('migrationPaths: compat first, numbered migrations in order, RLS-GUC last', () => {
  const files = migrationPaths(process.cwd()).map((f) => f.replace(/\\/g, '/'))
  assert.ok(files[0].endsWith('/db/neon/000_compat.sql'))
  assert.ok(files[files.length - 1].endsWith('/db/neon/zzz_rls_guc.sql'))

  const middle = files.slice(1, -1)
  assert.ok(middle.length >= 10)
  assert.ok(middle.every((f) => f.includes('/supabase/migrations/')))
  assert.deepEqual(middle, [...middle].sort()) // numeric order (001 < … < 010)
  assert.ok(middle.some((f) => f.endsWith('005_canonical_model.sql')))
})

test('Queryable round-trips an upsert + select (the repo SQL pattern) via pg-mem', async () => {
  const db = newDb()
  db.public.none(`create table feature_flags (
    tenant_id uuid not null, module_id text not null, enabled boolean not null,
    updated_at timestamptz not null default now(), primary key (tenant_id, module_id));`)
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const t = '00000000-0000-0000-0000-000000000001'

  // Upsert three times — the third flips 'coding' via ON CONFLICT DO UPDATE.
  const writes: [string, boolean][] = [['coding', false], ['billing', true], ['coding', true]]
  for (const [moduleId, enabled] of writes) {
    await pool.query(
      `insert into feature_flags (tenant_id, module_id, enabled, updated_at) values ($1, $2, $3, now())
       on conflict (tenant_id, module_id) do update set enabled = excluded.enabled, updated_at = now()`,
      [t, moduleId, enabled],
    )
  }

  const res = await pool.query(
    'select module_id, enabled from feature_flags where tenant_id = $1 order by module_id',
    [t],
  )
  assert.equal(res.rows.length, 2) // coding upserted, not duplicated
  assert.deepEqual(
    res.rows.map((r: { module_id: string; enabled: boolean }) => [r.module_id, r.enabled]),
    [['billing', true], ['coding', true]],
  )
})
