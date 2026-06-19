import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { CorpusRow, CorpusStat } from '../lib/corpus'
import { aggregate } from '../lib/corpus'
import { sampleObservations } from '../lib/corpus/sample'
import { corpusPredictor, estimateEncounter, denialRiskSignals, MODEL_ID } from '../lib/predict'

function stat(v: number, n = 40): CorpusStat {
  return { n, mean: v, p25: v, p50: v, p75: v, min: v, max: v }
}
function row(over: Partial<CorpusRow>): CorpusRow {
  return {
    payerExternalId: '00840',
    region: 'OK',
    specialty: 'family_medicine',
    cptHcpcs: '99214',
    modifier: '',
    contractClass: 'commercial',
    allowedStat: stat(14000),
    paidStat: stat(11000),
    daysToPayStat: stat(21),
    denialRate: 0.15,
    topCarcCodes: ['45'],
    sampleN: 40,
    ...over,
  }
}

const predictor = corpusPredictor([
  row({}),
  row({ cptHcpcs: '36415', allowedStat: stat(300), paidStat: stat(300), denialRate: 0, sampleN: 12 }),
  row({ payerExternalId: '04312', contractClass: 'medicare', sampleN: 30 }),
])

test('an exact corpus cell yields the empirical median, never an invented number', () => {
  const p = predictor.predict({ payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', cptHcpcs: '99214', modifier: '', contractClass: 'commercial' })
  assert.equal(p.basis, 'corpus_exact')
  assert.equal(p.predictedAllowedCents, 14000)
  assert.equal(p.predictedPaidCents, 11000)
  assert.equal(p.denialRisk, 0.15)
  assert.equal(p.expectedDaysToPay, 21)
  assert.equal(p.sampleN, 40)
  assert.ok(p.confidence > 0)
  assert.equal(p.calibrated, false)
  assert.equal(p.model, MODEL_ID)
})

test('no qualifying cell returns insufficient_data with null figures — never a guess', () => {
  const p = predictor.predict({ payerExternalId: '99999', region: 'OK', specialty: 'family_medicine', cptHcpcs: '99999', contractClass: 'commercial' })
  assert.equal(p.basis, 'insufficient_data')
  assert.equal(p.predictedAllowedCents, null)
  assert.equal(p.predictedPaidCents, null)
  assert.equal(p.denialRisk, null)
  assert.equal(p.confidence, 0)
  assert.match(p.reason, /not enough|do not guess/i)
})

test('confidence scales with sample size; predictions never claim calibration', () => {
  const big = predictor.predict({ payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', cptHcpcs: '99214', contractClass: 'commercial' }) // n=40
  const small = predictor.predict({ payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', cptHcpcs: '36415', contractClass: 'commercial' }) // n=12
  assert.ok(big.confidence > small.confidence)
  assert.equal(big.calibrated, false)
})

test('a fallback match (payer + region + cpt) is flagged and lower-confidence than exact', () => {
  // The 04312 cell is medicare; querying a different specialty/class falls back on payer+region+cpt.
  const p = predictor.predict({ payerExternalId: '04312', region: 'OK', specialty: 'cardiology', cptHcpcs: '99214', contractClass: 'commercial' })
  assert.equal(p.basis, 'corpus_fallback')
  assert.equal(p.predictedAllowedCents, 14000)
  const exact = predictor.predict({ payerExternalId: '04312', region: 'OK', specialty: 'family_medicine', cptHcpcs: '99214', contractClass: 'medicare' })
  assert.ok(p.confidence < exact.confidence)
})

test('estimateEncounter sums lines with data and flags the riskiest line', () => {
  const est = estimateEncounter(
    { payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', contractClass: 'commercial', lines: [{ cptHcpcs: '99214' }, { cptHcpcs: '36415' }, { cptHcpcs: '99999' }] },
    predictor,
  )
  assert.equal(est.lines.length, 3)
  assert.equal(est.linesWithData, 2) // 99999 has no data
  assert.equal(est.estimatedAllowedCents, 14300) // 14000 + 300
  assert.equal(est.maxDenialRisk, 0.15)
})

test('denialRiskSignals surfaces only lines at/above the threshold', () => {
  const signals = denialRiskSignals(
    { payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', contractClass: 'commercial', lines: [{ cptHcpcs: '99214' }, { cptHcpcs: '36415' }] },
    predictor,
    0.1,
  )
  assert.ok(signals.some((s) => s.cptHcpcs === '99214')) // denial 0.15 >= 0.1
  assert.ok(!signals.some((s) => s.cptHcpcs === '36415')) // denial 0 < 0.1
})

test('the baseline runs over the live (synthetic) corpus', () => {
  const live = corpusPredictor(aggregate(sampleObservations()).rows)
  const p = live.predict({ payerExternalId: '00840', region: 'OK', specialty: 'family_medicine', cptHcpcs: '99214', contractClass: 'commercial' })
  assert.equal(p.model, MODEL_ID)
  assert.equal(p.basis, 'corpus_exact')
  assert.ok((p.predictedAllowedCents ?? 0) > 0)
})
