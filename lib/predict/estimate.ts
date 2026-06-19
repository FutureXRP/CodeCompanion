import type { Cents } from '../canonical'
import type { Prediction, Predictor } from './types'

/**
 * The two uses of the predictor, built on the same per-line predictions:
 *   1. estimateEncounter — point-of-care: what a planned encounter will likely
 *      allow/pay, and how confident we are. (Patient responsibility needs
 *      eligibility 270/271 + a PR corpus stat — not estimated here, not guessed.)
 *   2. denialRiskSignals — a pre-submission advisory: lines the corpus says this
 *      payer denies often. A *signal*, kept separate from the deterministic
 *      scrubber so probabilistic and rule-based findings never blur together.
 */

export interface EncounterLineInput {
  cptHcpcs: string
  modifier?: string
}

export interface PlannedEncounter {
  payerExternalId: string
  region: string
  specialty: string
  contractClass: string
  lines: EncounterLineInput[]
}

export interface LineEstimate {
  cptHcpcs: string
  prediction: Prediction
}

export interface EncounterEstimate {
  lines: LineEstimate[]
  /** Sum of per-line predicted allowed/paid, over lines that had data. */
  estimatedAllowedCents: Cents
  estimatedPaidCents: Cents
  /** Highest per-line denial risk — the riskiest line drives the claim. Null if no data. */
  maxDenialRisk: number | null
  /** Lowest confidence among lines that had data; 0 if none did. */
  confidence: number
  linesWithData: number
}

export function estimateEncounter(enc: PlannedEncounter, predictor: Predictor): EncounterEstimate {
  const lines: LineEstimate[] = enc.lines.map((l) => ({
    cptHcpcs: l.cptHcpcs,
    prediction: predictor.predict({
      payerExternalId: enc.payerExternalId,
      region: enc.region,
      specialty: enc.specialty,
      cptHcpcs: l.cptHcpcs,
      modifier: l.modifier,
      contractClass: enc.contractClass,
    }),
  }))

  const withData = lines.filter((l) => l.prediction.basis !== 'insufficient_data')
  const sum = (pick: (p: Prediction) => number | null): Cents =>
    withData.reduce((acc, l) => acc + (pick(l.prediction) ?? 0), 0)

  const risks = withData.map((l) => l.prediction.denialRisk).filter((r): r is number => r !== null)
  return {
    lines,
    estimatedAllowedCents: sum((p) => p.predictedAllowedCents),
    estimatedPaidCents: sum((p) => p.predictedPaidCents),
    maxDenialRisk: risks.length ? Math.max(...risks) : null,
    confidence: withData.length ? Math.min(...withData.map((l) => l.prediction.confidence)) : 0,
    linesWithData: withData.length,
  }
}

export interface DenialRiskSignal {
  cptHcpcs: string
  denialRisk: number
  reason: string
}

/** Lines the corpus says this payer denies at or above `threshold`. Advisory only. */
export function denialRiskSignals(enc: PlannedEncounter, predictor: Predictor, threshold = 0.2): DenialRiskSignal[] {
  return estimateEncounter(enc, predictor)
    .lines.filter((l) => (l.prediction.denialRisk ?? 0) >= threshold)
    .map((l) => ({ cptHcpcs: l.cptHcpcs, denialRisk: l.prediction.denialRisk as number, reason: l.prediction.reason }))
}
