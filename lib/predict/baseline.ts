import { formatCents } from '../canonical'
import type { CorpusRow } from '../corpus'
import type { Prediction, PredictionBasis, PredictionInput, Predictor } from './types'

/**
 * The baseline predictor: an empirical lookup over the de-identified corpus. The
 * "prediction" for a cell is simply how that payer has actually behaved for that
 * code in that region — median allowed/paid, denial rate, days-to-pay. No
 * training, no inference beyond the empirical median; deterministic and
 * auditable. A trained model replaces this behind the same Predictor interface.
 *
 * Matching tiers:
 *   corpus_exact     — payer + region + specialty + cpt + modifier + contract class
 *   corpus_fallback  — payer + region + cpt (most-sampled cell), when no exact hit
 *   insufficient_data — nothing qualifies; all figures null, confidence 0
 */

export const MODEL_ID = 'corpus-baseline-v0'

// Samples needed for the confidence proxy to saturate. Crude, not calibrated.
const CONFIDENCE_SATURATION = 50

const exactKey = (p: string, r: string, s: string, c: string, m: string, k: string): string =>
  [p, r, s, c, m, k].join('')
const relaxedKey = (p: string, r: string, c: string): string => [p, r, c].join('')

function confidenceFor(sampleN: number, exact: boolean): number {
  const base = Math.min(0.9, sampleN / CONFIDENCE_SATURATION)
  return Math.round((exact ? base : base * 0.5) * 100) / 100
}

export class CorpusBaselinePredictor implements Predictor {
  private readonly exact = new Map<string, CorpusRow>()
  private readonly relaxed = new Map<string, CorpusRow>()

  constructor(rows: CorpusRow[]) {
    for (const r of rows) {
      this.exact.set(exactKey(r.payerExternalId, r.region, r.specialty, r.cptHcpcs, r.modifier, r.contractClass), r)
      const rk = relaxedKey(r.payerExternalId, r.region, r.cptHcpcs)
      const cur = this.relaxed.get(rk)
      if (!cur || r.sampleN > cur.sampleN) this.relaxed.set(rk, r) // keep the best-sampled cell
    }
  }

  predict(input: PredictionInput): Prediction {
    const modifier = input.modifier ?? ''
    const exact = this.exact.get(
      exactKey(input.payerExternalId, input.region, input.specialty, input.cptHcpcs, modifier, input.contractClass),
    )
    if (exact) return this.fromRow(exact, 'corpus_exact')

    const relaxed = this.relaxed.get(relaxedKey(input.payerExternalId, input.region, input.cptHcpcs))
    if (relaxed) return this.fromRow(relaxed, 'corpus_fallback')

    return {
      predictedAllowedCents: null,
      predictedPaidCents: null,
      denialRisk: null,
      expectedDaysToPay: null,
      confidence: 0,
      basis: 'insufficient_data',
      sampleN: 0,
      reason: `No corpus cell meets the suppression floor for payer ${input.payerExternalId} / ${input.cptHcpcs} in ${input.region}. Not enough adjudicated history to predict — do not guess.`,
      model: MODEL_ID,
      calibrated: false,
    }
  }

  private fromRow(row: CorpusRow, basis: Extract<PredictionBasis, 'corpus_exact' | 'corpus_fallback'>): Prediction {
    const allowed = row.allowedStat.p50
    const paid = row.paidStat.p50
    const days = row.daysToPayStat ? row.daysToPayStat.p50 : null
    const scope = basis === 'corpus_exact' ? 'this payer/code/region' : `payer ${row.payerExternalId} / ${row.cptHcpcs} in ${row.region}`
    return {
      predictedAllowedCents: allowed,
      predictedPaidCents: paid,
      denialRisk: row.denialRate,
      expectedDaysToPay: days,
      confidence: confidenceFor(row.sampleN, basis === 'corpus_exact'),
      basis,
      sampleN: row.sampleN,
      reason: `Across ${row.sampleN} adjudicated lines for ${scope}: allows ~${formatCents(allowed)} (median), pays ~${formatCents(paid)}, denies ${Math.round(row.denialRate * 100)}%${days !== null ? `, ~${days}d to pay` : ''}.`,
      model: MODEL_ID,
      calibrated: false,
    }
  }
}
