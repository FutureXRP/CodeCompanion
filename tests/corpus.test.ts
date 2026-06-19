import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSampleClaims, loadSampleRemittances } from '../lib/adapters/edi'
import { observe, aggregate, buildCorpus, distribution, assertDeidentified, MIN_SAMPLE_N, type CorpusRow } from '../lib/corpus'
import { sampleObservations } from '../lib/corpus/sample'
import { toCorpusRow } from '../lib/db/mappers'

// PHI present in the sample 837/835 that must NEVER reach the corpus.
const SAMPLE_PHI = ['1EG4TE5MK73', 'DOE', 'JOHN', '19500101', '1950-01-01', 'PATIENT001', 'PATIENT002', '20260115', '2026-01-15']
const FORBIDDEN_KEY = /tenant|patient|claim|encounter|member|subscriber|mrn|ssn|npi|dob|birth|name|address|email|phone|account/i

test('observe() strips all PHI from real canonical claims', () => {
  const obs = observe(loadSampleClaims(), loadSampleRemittances(), { region: 'OK', specialty: 'family_medicine' })
  assert.ok(obs.length > 0)
  const serialized = JSON.stringify(obs)
  for (const phi of SAMPLE_PHI) assert.ok(!serialized.includes(phi), `observation leaked PHI: ${phi}`)
  // Structural: no observation carries an identifier-shaped key.
  for (const o of obs) for (const k of Object.keys(o)) assert.ok(!FORBIDDEN_KEY.test(k), `observation has forbidden key ${k}`)
})

test('aggregate() suppresses cells below the sample floor and emits the rest', () => {
  const result = aggregate(sampleObservations())
  // 3 cells have n >= 11; one cell (n = 3) is suppressed.
  assert.equal(result.rows.length, 3)
  assert.equal(result.suppressed, 1)
  assert.equal(result.observations, 51)
  for (const row of result.rows) assert.ok(row.sampleN >= MIN_SAMPLE_N)
  // The small cell never appears.
  assert.ok(!result.rows.some((r) => r.payerExternalId === '73143'))
})

test('every emitted corpus row passes the gate and carries no identifier key', () => {
  const { rows } = aggregate(sampleObservations())
  const serialized = JSON.stringify(rows)
  for (const phi of SAMPLE_PHI) assert.ok(!serialized.includes(phi))
  for (const row of rows) {
    assertDeidentified(row) // must not throw
    for (const k of Object.keys(row)) assert.ok(!FORBIDDEN_KEY.test(k))
  }
})

test('the gate throws if an identifier is smuggled onto a row', () => {
  const [row] = aggregate(sampleObservations()).rows
  assert.throws(() => assertDeidentified({ ...row, tenantId: 't-123' } as unknown as CorpusRow), /forbidden identifier key/)
  assert.throws(() => assertDeidentified({ ...row, patientMemberId: 'X' } as unknown as CorpusRow), /forbidden identifier key/)
  assert.throws(() => assertDeidentified({ ...row, claimId: 'c1' } as unknown as CorpusRow), /forbidden identifier key/)
})

test('the gate enforces small-cell suppression (sample_n >= floor)', () => {
  const [row] = aggregate(sampleObservations()).rows
  assert.throws(() => assertDeidentified({ ...row, sampleN: 3 }), /suppression floor/)
  // The library floor matches the DB CHECK constraint (008_corpus.sql).
  assert.equal(MIN_SAMPLE_N, 11)
})

test('the gate rejects a region that is not coarse geography', () => {
  const [row] = aggregate(sampleObservations()).rows
  assert.throws(() => assertDeidentified({ ...row, region: '123 Main St, Tulsa' }), /coarse geography/)
})

test('buildCorpus pipeline produces de-identified rows with behavior stats', () => {
  const { rows, suppressed } = buildCorpus(loadSampleClaims(), loadSampleRemittances(), { region: 'OK', specialty: 'family_medicine' })
  // The sample has one observation per cell, so at the floor of 11 everything is suppressed.
  assert.equal(rows.length, 0)
  assert.ok(suppressed > 0)
})

test('distribution summarizes without keeping raw values', () => {
  const d = distribution([100, 200, 300, 400])
  assert.equal(d.n, 4)
  assert.equal(d.mean, 250)
  assert.equal(d.min, 100)
  assert.equal(d.max, 400)
  assert.equal(d.p50, 300)
})

test('a corpus DB row has no tenant/patient/claim column', () => {
  const [row] = aggregate(sampleObservations()).rows
  const dbRow = toCorpusRow('payer-uuid', row)
  for (const k of Object.keys(dbRow)) assert.ok(!FORBIDDEN_KEY.test(k), `db row has forbidden column ${k}`)
  assert.equal(dbRow.payer_id, 'payer-uuid')
  assert.ok(dbRow.sample_n >= MIN_SAMPLE_N)
})
