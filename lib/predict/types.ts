import type { Cents } from '../canonical'

/**
 * Predictive adjudication (Rung 2) — the read-model over the behavioral corpus.
 *
 * STUB. This defines the seam and a deterministic empirical baseline; a trained,
 * calibrated model swaps in behind the `Predictor` interface later. Two uses from
 * one model (ARCHITECTURE Layer 5): a pre-submission denial-risk signal, and a
 * point-of-care allowed/paid estimate.
 *
 * DISCIPLINE: the predictor reads aggregate corpus statistics; it NEVER invents a
 * number. When the corpus has no qualifying cell, every figure is null and the
 * basis is 'insufficient_data' — you do not underwrite on a guess (CLAUDE.md).
 * Predictions are marked `calibrated: false` until a model is empirically
 * calibrated on real adjudications. The LLM's role (explaining *why*) is a future
 * Layer 7 task; the numbers here stay deterministic.
 */

export interface PredictionInput {
  payerExternalId: string
  region: string
  specialty: string
  cptHcpcs: string
  modifier?: string
  contractClass: string
}

export type PredictionBasis = 'corpus_exact' | 'corpus_fallback' | 'insufficient_data'

export interface Prediction {
  /** Predicted allowed amount (median), cents. Null when there is insufficient data. */
  predictedAllowedCents: Cents | null
  /** Predicted paid amount (median), cents. Null when there is insufficient data. */
  predictedPaidCents: Cents | null
  /** Probability of denial, 0..1. Null when there is insufficient data. */
  denialRisk: number | null
  /** Expected days from service to payment (median). Null when unknown. */
  expectedDaysToPay: number | null
  /** Confidence 0..1 — a crude function of the supporting sample size, not a calibrated probability. */
  confidence: number
  basis: PredictionBasis
  /** Observations behind the prediction (0 when insufficient). */
  sampleN: number
  /** Deterministic, template explanation. NOT LLM-generated. */
  reason: string
  /** Model id + calibration status — never claims calibration we don't have. */
  model: string
  calibrated: boolean
}

/** The seam: any predictor (baseline now, trained model later) implements this. */
export interface Predictor {
  predict(input: PredictionInput): Prediction
}
