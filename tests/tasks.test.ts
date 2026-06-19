import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildTaskQueue } from '../lib/tasks'

test('task queue: non-empty, owned, prioritized, reconciled', () => {
  const q = buildTaskQueue()
  assert.ok(q.tasks.length > 0)
  assert.equal(q.counts.total, q.tasks.length)
  assert.equal(q.counts.open + q.counts.inProgress + q.counts.done, q.tasks.length)

  for (const t of q.tasks) {
    assert.ok(t.assignee.length > 0)
    assert.ok(['high', 'medium', 'low'].includes(t.priority))
    assert.ok(t.dollarsCents > 0)
    assert.equal(t.overdue, t.dueInDays < 0 && t.status !== 'done')
  }

  const atStake = q.tasks.filter((t) => t.status !== 'done').reduce((s, t) => s + t.dollarsCents, 0)
  assert.equal(q.dollarsAtStakeCents, atStake)
  // overdue is a realistic subset, not the whole queue
  assert.ok(q.counts.overdue < q.tasks.length)
})

test('task queue: deterministic and partitioned overdue-first', () => {
  const a = buildTaskQueue()
  const b = buildTaskQueue()
  assert.equal(a.tasks.length, b.tasks.length)
  assert.equal(a.dollarsAtStakeCents, b.dollarsAtStakeCents)

  const firstClear = a.tasks.findIndex((t) => !t.overdue)
  if (firstClear !== -1) {
    for (let i = 0; i < firstClear; i++) assert.ok(a.tasks[i].overdue)
    for (let i = firstClear; i < a.tasks.length; i++) assert.ok(!a.tasks[i].overdue)
  }
})
