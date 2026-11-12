import { test } from 'node:test'
import assert from 'node:assert/strict'

import { assertRealPhiAllowed, phiHostingProblems, realPhiAllowed, realPhiRefusal } from '../lib/compliance/gate'

const safe = {
  ALLOW_REAL_PHI: 'true',
  BAA_SIGNED: 'true',
  HIPAA_SECURITY_REVIEW: 'true',
  DATABASE_URL: 'postgres://app:secret@ep-x.neon.tech/db?sslmode=require',
}

test('a BAA-covered, TLS-verified deployment with the acknowledgements passes', () => {
  assert.deepEqual(phiHostingProblems(safe), [])
  assert.equal(realPhiAllowed(safe), true)
  assert.equal(realPhiRefusal('x', safe), null)
  assert.doesNotThrow(() => assertRealPhiAllowed('x', safe))
})

test('the master switch off refuses with the COMPLIANCE message, whatever else is set', () => {
  assert.equal(realPhiAllowed({}), false)
  assert.equal(realPhiAllowed({ ...safe, ALLOW_REAL_PHI: 'false' }), false)
  assert.throws(() => assertRealPhiAllowed('Tebra live integration', {}), /ALLOW_REAL_PHI is not true/)
  assert.throws(() => assertRealPhiAllowed('Tebra live integration', {}), /COMPLIANCE/)
})

test('the switch on is not enough: the Vercel demo host is never a PHI host', () => {
  const p = phiHostingProblems({ ...safe, VERCEL: '1' })
  assert.equal(p.length, 1)
  assert.match(p[0], /Vercel/)
  assert.equal(realPhiAllowed({ ...safe, VERCEL: '1' }), false)
  assert.throws(() => assertRealPhiAllowed('x', { ...safe, VERCEL: '1' }), /not safe for real patient data/)
})

test('the BAA and the security review must be acknowledged', () => {
  assert.match(phiHostingProblems({ ...safe, BAA_SIGNED: undefined }).join(' '), /BAA_SIGNED/)
  assert.match(phiHostingProblems({ ...safe, HIPAA_SECURITY_REVIEW: 'no' }).join(' '), /HIPAA_SECURITY_REVIEW/)
  assert.equal(realPhiAllowed({ ...safe, BAA_SIGNED: 'false' }), false)
})

test('TLS to the database: sslmode=require with verification on, except on localhost', () => {
  assert.match(phiHostingProblems({ ...safe, DATABASE_URL: 'postgres://app:secret@ep-x.neon.tech/db' }).join(' '), /sslmode=require/)
  assert.deepEqual(phiHostingProblems({ ...safe, DATABASE_URL: 'postgres://app:secret@localhost:5432/db' }), [])
  assert.deepEqual(phiHostingProblems({ ...safe, DATABASE_URL: 'postgres://app:secret@127.0.0.1/db' }), [])
  assert.match(phiHostingProblems({ ...safe, PG_SSL_STRICT: 'false' }).join(' '), /PG_SSL_STRICT/)
  assert.deepEqual(phiHostingProblems({ ...safe, DATABASE_URL: undefined }), []) // no database yet is not a hosting problem
})

test('every problem is reported at once, so one fix round closes the gate', () => {
  const p = phiHostingProblems({ ALLOW_REAL_PHI: 'true', VERCEL: '1', DATABASE_URL: 'postgres://a:b@ep.neon.tech/db', PG_SSL_STRICT: 'false' })
  assert.equal(p.length, 5) // Vercel, BAA, review, sslmode, strict
})
