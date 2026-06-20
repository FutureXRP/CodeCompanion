import { test } from 'node:test'
import assert from 'node:assert/strict'

import { defaultFlags, resolveFlags, isEnabled, disabledIds, parseOverrides, serializeOverrides, applyPreset } from '../lib/admin/flags'
import { MODULES } from '../lib/admin/modules'

test('defaultFlags includes every module at its default', () => {
  const f = defaultFlags()
  assert.equal(Object.keys(f).length, MODULES.length)
  for (const m of MODULES) assert.equal(f[m.id], m.defaultOn)
})

test('resolveFlags applies overrides but keeps locked modules on', () => {
  const f = resolveFlags({ coding: false, command: false, admin: false })
  assert.equal(f.coding, false) // delegable module turned off
  assert.equal(f.command, true) // locked — cannot be disabled
  assert.equal(f.admin, true) // locked
  assert.equal(f.eligibility, true) // untouched default
  assert.ok(isEnabled(f, 'eligibility'))
  assert.ok(!isEnabled(f, 'coding'))
})

test('disabledIds lists off, non-locked modules only', () => {
  const ids = disabledIds(resolveFlags({ coding: false, command: false }))
  assert.ok(ids.includes('coding'))
  assert.ok(!ids.includes('command'))
})

test('parseOverrides ignores junk, unknown keys, and non-booleans', () => {
  assert.deepEqual(parseOverrides('{"coding":false,"nope":true,"eligibility":"x"}'), { coding: false })
  assert.deepEqual(parseOverrides('not json'), {})
  assert.deepEqual(parseOverrides(undefined), {})
})

test('serializeOverrides round-trips and never serializes locked modules', () => {
  const round = parseOverrides(serializeOverrides(resolveFlags({ coding: false, gaps: false })))
  assert.equal(round.coding, false)
  assert.equal(round.gaps, false)
  assert.equal(round.command, undefined)
})

test('preset "rcm" delegates clinical (off) and keeps billing/core/system on; "all" enables everything', () => {
  const rcm = applyPreset('rcm')
  for (const m of MODULES) {
    if (m.locked) { assert.equal(rcm[m.id], true); continue }
    assert.equal(rcm[m.id], m.group !== 'clinical')
  }
  assert.equal(rcm.coding, false)
  assert.equal(rcm.eligibility, true)

  const all = applyPreset('all')
  for (const m of MODULES) assert.equal(all[m.id], true)
})
