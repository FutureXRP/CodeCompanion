import type { Claim, Remittance } from '../canonical'
import { observe, type ObserveDims } from './observe'
import { aggregate } from './aggregate'
import type { CorpusResult } from './types'

export * from './types'
export { observe, type ObserveDims } from './observe'
export { aggregate } from './aggregate'
export { distribution } from './stats'
export { assertDeidentified, assertObservationClean, MIN_SAMPLE_N } from './gate'

/**
 * The full one-way pipeline: PHI-bearing canonical claims + remittances →
 * de-identified, small-cell-suppressed corpus rows. There is no inverse.
 */
export function buildCorpus(
  claims: Claim[],
  remittances: Remittance[],
  dims: ObserveDims,
  minSampleN?: number,
): CorpusResult {
  return aggregate(observe(claims, remittances, dims), minSampleN)
}
