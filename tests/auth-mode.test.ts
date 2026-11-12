import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isLoginRequired } from '../lib/db/config'
import { goLiveReadiness } from '../lib/config/readiness'

test('login gate: off by default, on with REQUIRE_LOGIN=true', () => {
  assert.equal(isLoginRequired({}), false)
  assert.equal(isLoginRequired({ NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a' }), false) // configured ≠ required
  assert.equal(isLoginRequired({ REQUIRE_LOGIN: 'true' }), true)
  assert.equal(isLoginRequired({ REQUIRE_LOGIN: 'false' }), false)
  assert.equal(isLoginRequired({ REQUIRE_LOGIN: 'yes' }), false)
})

test('login gate: real PHI always forces it on — REQUIRE_LOGIN cannot switch it off', () => {
  assert.equal(isLoginRequired({ ALLOW_REAL_PHI: 'true' }), true)
  assert.equal(isLoginRequired({ ALLOW_REAL_PHI: 'true', REQUIRE_LOGIN: 'false' }), true)
  assert.equal(isLoginRequired({ ALLOW_REAL_PHI: 'false' }), false)
})

test('readiness reports the gate: pending while off, pass when on or when PHI forces it', () => {
  const off = goLiveReadiness({}).checks.find((c) => c.id === 'login')!
  assert.equal(off.status, 'pending')
  assert.equal(off.required, false) // informational — the code enforces PHI ⇒ login
  assert.equal(goLiveReadiness({ REQUIRE_LOGIN: 'true' }).checks.find((c) => c.id === 'login')?.status, 'pass')
  assert.equal(goLiveReadiness({ ALLOW_REAL_PHI: 'true' }).checks.find((c) => c.id === 'login')?.status, 'pass')
})
