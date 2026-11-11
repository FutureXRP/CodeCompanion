import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MockTebraSource, sampleTebraContractRates } from '../lib/adapters/tebra'
import { runTebraPreApproval } from '../lib/capture'
import { closeStaleTasks, updateTask, upsertTasks } from '../lib/db/operational-repo'
import type { Queryable } from '../lib/db/sql'
import { runTebraFoundMoney } from '../lib/found-money/tebra'
import { syncTebraWindow } from '../lib/sync/tebra'
import { queueFromTasks, tasksFromReview, tasksFromStored, tasksFromWorkbench } from '../lib/tasks'

function fakeDb(answer: (sql: string, params?: unknown[]) => { rows?: unknown[]; rowCount?: number } | undefined = () => undefined) {
  const log: { sql: string; params?: unknown[] }[] = []
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      const entry = { sql: sql.replace(/\s+/g, ' ').trim(), params }
      log.push(entry)
      const a = answer(entry.sql, params) ?? {}
      return { rows: a.rows ?? [], rowCount: a.rowCount ?? 0 }
    },
  } as unknown as Queryable
  return { db, log }
}

test('tasksFromWorkbench: one keyed task per item, source by category, priority by dollars, no patient name', async () => {
  const now = new Date('2026-02-14T12:00:00Z')
  const { workbench } = await runTebraFoundMoney(new MockTebraSource(), { serviceDateFrom: '2026-01-15' }, [], now)
  const tasks = tasksFromWorkbench(workbench)
  assert.equal(tasks.length, 6)
  assert.deepEqual(
    tasks.map((t) => [t.sourceKey, t.source, t.priority, t.dollarsCents]),
    [
      ['appeal_denial:E-2003:1', 'denial', 'medium', 12800],
      ['status_check:E-2004:1', 'follow_up', 'medium', 11000],
      ['resubmit_rejected:E-2004:2', 'follow_up', 'low', 2500],
      ['bill_secondary:E-2001:1', 'balance', 'low', 2250],
      ['send_statement:E-2002:1', 'balance', 'low', 1600],
      ['appeal_underpayment:E-2002:1', 'denial', 'low', 1500],
    ],
  )
  assert.equal(tasks[0].title, 'Appeal denial · 99215 · SoonerCare')
  assert.match(tasks[0].detail, /^E-2003 · DOS 2026-01-15 — Appeal/)
  assert.ok(!/OKAFOR/.test(tasks[0].detail)) // PHI minimization: no name in the stored task
  assert.equal(tasks[0].assignee, 'A/R')
  assert.equal(tasks[1].assignee, 'Billing')
  assert.equal(tasks[3].assignee, 'Front desk')
  assert.equal(tasksFromWorkbench(workbench, { denial: 'Priya' })[0].assignee, 'Priya')
  assert.equal(tasks[1].ageDays, 30)
  assert.equal(tasks[0].dueInDays, 14)
})

test('tasksFromReview: only blocked / fix encounters become tasks, blocked ones high priority', async () => {
  const { report } = await runTebraPreApproval(new MockTebraSource(), { serviceDateFrom: '2026-01-15' }, sampleTebraContractRates())
  const tasks = tasksFromReview(report)
  assert.deepEqual(
    tasks.map((t) => [t.sourceKey, t.priority, t.dollarsCents]),
    [
      ['review:P-3006', 'high', 13500],
      ['review:P-3001', 'high', 21650],
      ['review:P-3002', 'medium', 14000],
      ['review:P-3003', 'medium', 7200],
    ],
  )
  assert.equal(tasks[0].title, 'Will reject — fix before approving · P-3006')
  assert.match(tasks[0].detail, /93000 has no diagnosis; E\/M needs modifier 25/)
  assert.match(tasks[1].detail, /\$112\.50 at risk, \$104\.00 if documented/)
  assert.ok(tasks.every((t) => t.source === 'review' && t.href === '/review'))
})

test('upsertTasks / closeStaleTasks / updateTask: the SQL shape — keyed upsert that keeps human edits', async () => {
  const { db, log } = fakeDb((sql) => (/^update tasks/.test(sql) ? { rowCount: 2 } : undefined))
  const now = new Date('2026-02-14T12:00:00Z')
  const { workbench } = await runTebraFoundMoney(new MockTebraSource(), { serviceDateFrom: '2026-01-15' }, [], now)
  const n = await upsertTasks(db, 'tenant-1', tasksFromWorkbench(workbench), now)
  assert.equal(n, 6)
  const upsert = log[0].sql
  assert.match(upsert, /^insert into "tasks" \("tenant_id", "source", "title", "detail", "dollars_cents", "assignee", "status", "priority", "due_date", "source_key"\)/)
  assert.match(upsert, /on conflict \("tenant_id", "source_key"\) do update set "title" = excluded\."title", "detail" = excluded\."detail", "dollars_cents" = excluded\."dollars_cents", "priority" = excluded\."priority"$/)
  assert.ok(!/excluded\."assignee"|excluded\."status"|excluded\."due_date"/.test(upsert))
  assert.equal(log[0].params?.[8], '2026-02-28') // medium priority → 14-day SLA from asOf
  assert.equal(await upsertTasks(db, 'tenant-1', [], now), 0)

  const closed = await closeStaleTasks(db, 'tenant-1', ['E-2003', 'P-3001'], ['appeal_denial:E-2003:1'])
  assert.equal(closed, 2)
  const close = log.at(-1)!
  assert.match(close.sql, /split_part\(source_key, ':', 2\) in \(\$2, \$3\) and source_key not in \(\$4\)/)
  assert.deepEqual(close.params, ['tenant-1', 'E-2003', 'P-3001', 'appeal_denial:E-2003:1'])
  assert.equal(await closeStaleTasks(db, 'tenant-1', [], []), 0)

  assert.equal(await updateTask(db, 'tenant-1', 'task-9', { status: 'done', assignee: 'Dana' }), true)
  assert.match(log.at(-1)!.sql, /^update tasks set status = \$3, assignee = \$4, updated_at = now\(\) where tenant_id = \$1 and id = \$2$/)
  assert.equal(await updateTask(db, 'tenant-1', 'task-9', {}), false)
})

test('syncTebraWindow with includeReview: workbench + review tasks upserted, stale ones closed', async () => {
  let seq = 0
  const { db, log } = fakeDb((sql, params) => {
    if (/^update tasks/.test(sql)) return { rowCount: 1 }
    if (/^insert into "claim_lines"/.test(sql)) {
      const n = (params?.length ?? 0) / 7
      return { rows: Array.from({ length: n }, (_, i) => ({ id: `line-${++seq}`, line_number: params![i * 7 + 1] })) }
    }
    if (/returning id/.test(sql)) return { rows: [{ id: `id-${++seq}` }] }
    return undefined
  })
  const s = await syncTebraWindow({
    source: new MockTebraSource(), db, tenantId: 'tenant-1', query: { serviceDateFrom: '2026-01-15' }, live: false,
    fallbackRates: sampleTebraContractRates(), includeReview: true, now: new Date('2026-02-14T12:00:00Z'),
  })
  assert.deepEqual(s.tasks, { upserted: 10, closed: 1, review: 4 })
  const close = log.find((l) => /^update tasks set status = 'done'/.test(l.sql))!
  // Both the adjudicated claims and the pending encounters are in scope for closing.
  assert.ok((close.params as string[]).includes('E-2001') && (close.params as string[]).includes('P-3006'))
})

test('tasksFromStored + queueFromTasks: SLA from the stored due date, age from creation', () => {
  const now = new Date('2026-03-01T12:00:00Z')
  const tasks = tasksFromStored(
    [
      { id: 'a', source: 'denial', sourceKey: 'appeal_denial:E-1:1', title: 'Appeal', detail: null, dollarsCents: 12800, assignee: 'Priya', status: 'open', priority: 'medium', dueDate: '2026-02-20', createdAt: '2026-02-06' },
      { id: 'b', source: 'review', sourceKey: 'review:P-1', title: 'Fix', detail: 'x', dollarsCents: 500, assignee: null, status: 'done', priority: 'low', dueDate: '2026-02-20', createdAt: '2026-02-06' },
      { id: 'c', source: 'balance', sourceKey: null, title: 'Collect', detail: 'y', dollarsCents: 2000, assignee: 'Marco', status: 'in_progress', priority: 'low', dueDate: '2026-03-10', createdAt: '2026-02-28' },
    ],
    now,
  )
  assert.deepEqual(tasks.map((t) => [t.id, t.ageDays, t.dueInDays, t.overdue, t.assignee, t.href]), [
    ['a', 23, -9, true, 'Priya', '/workbench'],
    ['b', 23, -9, false, 'Unassigned', '/review'],
    ['c', 1, 9, false, 'Marco', '/workbench'],
  ])
  const q = queueFromTasks(tasks)
  assert.equal(q.tasks[0].id, 'a') // overdue first
  assert.deepEqual(q.counts, { total: 3, open: 1, inProgress: 1, done: 1, overdue: 1 })
  assert.equal(q.dollarsAtStakeCents, 14800)
})
