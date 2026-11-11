import { test } from 'node:test'
import assert from 'node:assert/strict'

import { foundMoneySourceKind, loadFoundMoney } from '../lib/found-money/source'

test('source kind: an explicit FOUND_MONEY_SOURCE wins; real 837/835 files pick the file path; otherwise the PM pull', () => {
  assert.equal(foundMoneySourceKind({ FOUND_MONEY_SOURCE: 'files' }), 'files')
  assert.equal(foundMoneySourceKind({ FOUND_MONEY_SOURCE: 'tebra', EDI_USE_SAMPLE_FILES: 'false' }), 'tebra')
  assert.equal(foundMoneySourceKind({ EDI_USE_SAMPLE_FILES: 'false' }), 'files')
  assert.equal(foundMoneySourceKind({}), 'tebra')
  assert.equal(foundMoneySourceKind({ FOUND_MONEY_SOURCE: 'nonsense' }), 'tebra')
})

test('loadFoundMoney on the mock Tebra source: the report is the Tebra diff and every finding has its claim', async () => {
  delete process.env.FOUND_MONEY_SOURCE
  const v = await loadFoundMoney()
  assert.equal(v.kind, 'tebra')
  assert.equal(v.live, false)
  assert.match(v.label, /Tebra · mock/)
  assert.equal(v.report.meta.source, 'tebra')
  assert.ok(v.report.findings.length > 0)
  const controls = new Set(v.claims.map((c) => c.controlNumber))
  for (const f of v.report.findings) assert.ok(controls.has(f.claimControlNumber), `finding ${f.id} has no claim`)
  // The appeal drafter looks a finding up by id on the same source — ids must be unique.
  assert.equal(new Set(v.report.findings.map((f) => f.id)).size, v.report.findings.length)
  assert.ok(v.report.findings.some((f) => f.type === 'denial' && f.appealable), 'the mock day has an appealable denial to draft from')
})

test('loadFoundMoney with FOUND_MONEY_SOURCE=files runs the sample 837/835 path', async () => {
  process.env.FOUND_MONEY_SOURCE = 'files'
  try {
    const v = await loadFoundMoney()
    assert.equal(v.kind, 'files')
    assert.equal(v.live, false)
    assert.equal(v.report.meta.source, 'samples')
    assert.ok(v.report.findings.length > 0)
    assert.ok(v.claims.length > 0)
  } finally {
    delete process.env.FOUND_MONEY_SOURCE
  }
})
