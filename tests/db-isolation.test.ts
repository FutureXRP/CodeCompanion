import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isolationProblems, type IsolationReport } from '../lib/db/isolation'

const clean: IsolationReport = {
  role: 'cc_app',
  superuser: false,
  bypassRls: false,
  rlsTables: ['claims', 'patients', 'tasks', 'audit_log'],
  unforcedTables: [],
  ownedTables: [],
  policylessTables: [],
  serviceContext: true,
}

test('a non-owner role, every table forced, the service context present → enforced', () => {
  assert.deepEqual(isolationProblems(clean), [])
})

test('a superuser or BYPASSRLS role is never isolated, however the tables are set up', () => {
  assert.match(isolationProblems({ ...clean, superuser: true }).join(' '), /superuser/)
  assert.match(isolationProblems({ ...clean, bypassRls: true }).join(' '), /BYPASSRLS/)
})

test('the owner connection is a problem — the owner can switch RLS off', () => {
  const p = isolationProblems({ ...clean, role: 'neondb_owner', ownedTables: ['claims', 'patients'] })
  assert.equal(p.length, 1)
  assert.match(p[0], /owns 2 RLS table/)
  assert.match(p[0], /codecompanion_app/)
})

test('tables not forced, or without any policy, or a missing service context → migration 014', () => {
  assert.match(isolationProblems({ ...clean, unforcedTables: ['claims'] }).join(' '), /not forced on 1 table/)
  assert.match(isolationProblems({ ...clean, policylessTables: ['payer_behavior_corpus'] }).join(' '), /no policy/)
  assert.match(isolationProblems({ ...clean, serviceContext: false }).join(' '), /app_is_service/)
  assert.match(isolationProblems({ ...clean, rlsTables: [] }).join(' '), /no row-level-security tables/)
})

test('long table lists are abbreviated, not dumped', () => {
  const many = Array.from({ length: 12 }, (_, i) => `t${i}`)
  const p = isolationProblems({ ...clean, unforcedTables: many }).join(' ')
  assert.match(p, /t0, t1, t2, t3, t4, t5, …/)
  assert.ok(!p.includes('t11'))
})
