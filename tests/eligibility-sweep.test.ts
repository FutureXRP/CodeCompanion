import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildScheduleSweep, sampleSchedule } from '../lib/rcm/eligibility-sweep'
import { MockEligibilityService } from '../lib/rcm/eligibility'

test('schedule sweep classifies coverage and flags inactive members', async () => {
  const schedule = sampleSchedule()
  const sweep = await buildScheduleSweep(schedule, new MockEligibilityService())

  assert.equal(sweep.counts.total, schedule.length)
  assert.equal(sweep.counts.active + sweep.counts.issues, schedule.length)
  assert.ok(sweep.counts.active > 0)
  assert.ok(sweep.counts.issues >= 2) // the sample carries two INACTIVE members

  for (const item of sweep.items) {
    if (item.status === 'inactive') assert.ok(item.flags.some((f) => /inactive/i.test(f)))
    if (item.status === 'active') assert.ok(item.copayCents != null) // active members return benefits
  }
  assert.ok(sweep.estimatedCopayCents > 0)
})
