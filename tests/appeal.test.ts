import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Finding } from '../lib/canonical'
import { appealTemplate, findInventedAmounts, isAppealDraftable, draftAppealLetter } from '../lib/ai/appeal'

function denial(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'denial:PATIENT002:1',
    type: 'denial',
    claimControlNumber: 'PATIENT002',
    claimLineId: 'PATIENT002:1',
    payerName: 'MEDICARE',
    payerExternalId: '00123',
    cptHcpcs: '99215',
    modifiers: [],
    dateOfService: '2026-01-20',
    expectedCents: 16000,
    actualCents: 0,
    deltaCents: 16000,
    recoverableCents: 16000,
    appealable: true,
    status: 'open',
    carcCode: '197',
    reason: 'CARC 197 — auth absent.',
    detectedAt: '2026-06-17T00:00:00Z',
    ...overrides,
  }
}

test('isAppealDraftable: denials/underpayments yes, undercoding no', () => {
  assert.equal(isAppealDraftable(denial()), true)
  assert.equal(isAppealDraftable(denial({ type: 'underpayment' })), true)
  assert.equal(isAppealDraftable(denial({ type: 'undercoding', appealable: false })), false)
})

test('appealTemplate cites payer, claim, CARC, and only allowed figures', () => {
  const letter = appealTemplate(denial())
  assert.match(letter, /MEDICARE/)
  assert.match(letter, /PATIENT002/)
  assert.match(letter, /CARC 197/)
  assert.match(letter, /\$160\.00/)
  // the deterministic template never introduces a figure outside the finding
  assert.deepEqual(findInventedAmounts(letter, ['$160.00', '$0.00']), [])
})

test('findInventedAmounts flags any dollar figure outside the allowed set', () => {
  assert.deepEqual(findInventedAmounts('We seek $160.00, not $999.99.', ['$160.00']), ['$999.99'])
  assert.deepEqual(findInventedAmounts('Exactly $160.00.', ['$160.00']), [])
  assert.deepEqual(findInventedAmounts('$1,250.00 and $12.50', ['$1,250.00', '$12.50']), [])
})

test('draftAppealLetter falls back to the template when no API key is set', async () => {
  const prev = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  try {
    const draft = await draftAppealLetter(denial())
    assert.equal(draft.mode, 'template')
    assert.match(draft.letter, /MEDICARE/)
    assert.ok(draft.note && draft.note.length > 0)
  } finally {
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
  }
})
