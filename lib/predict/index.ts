import type { CorpusRow } from '../corpus'
import { CorpusBaselinePredictor } from './baseline'
import type { Predictor } from './types'

export * from './types'
export { CorpusBaselinePredictor, MODEL_ID } from './baseline'
export {
  estimateEncounter,
  denialRiskSignals,
  type PlannedEncounter,
  type EncounterLineInput,
  type EncounterEstimate,
  type LineEstimate,
  type DenialRiskSignal,
} from './estimate'

/** Build the baseline predictor over a set of de-identified corpus rows. */
export function corpusPredictor(rows: CorpusRow[]): Predictor {
  return new CorpusBaselinePredictor(rows)
}
