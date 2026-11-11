import type { FeeScheduleLine } from '../canonical'
import { FeeSchedule } from '../adapters/fee-schedule'
import { pullTebraCanonical, type TebraCanonicalPull, type TebraChargeQuery, type TebraSource } from '../adapters/tebra'
import { runFoundMoneyFrom, type FoundMoneyReport } from './run'

/**
 * Found money straight from Tebra: a GetCharges pull already carries billed,
 * contract-expected and adjudicated amounts per line, so the Rung 0 diff runs on
 * it with no 835 file in the loop. Deterministic throughout.
 */

export interface TebraFoundMoney extends TebraCanonicalPull {
  feeSchedule: FeeSchedule
  report: FoundMoneyReport
}

/**
 * Tebra's contract rates win; `fallbackRates` (e.g. the practice's CSV) fill any
 * payer/code Tebra has no active contract for.
 */
export async function runTebraFoundMoney(
  source: TebraSource,
  query: TebraChargeQuery,
  fallbackRates: FeeScheduleLine[] = [],
): Promise<TebraFoundMoney> {
  const pull = await pullTebraCanonical(source, query)
  const feeSchedule = new FeeSchedule([...fallbackRates, ...pull.feeScheduleLines]) // later lines override
  const report = runFoundMoneyFrom(pull.claims, pull.remittances, feeSchedule, 'tebra')
  return { ...pull, feeSchedule, report }
}
