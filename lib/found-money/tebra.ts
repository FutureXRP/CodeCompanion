import type { FeeScheduleLine } from '../canonical'
import { FeeSchedule } from '../adapters/fee-schedule'
import { pullTebraCanonical, type TebraCanonicalPull, type TebraChargeQuery, type TebraSource } from '../adapters/tebra'
import { runFoundMoneyFrom, type FoundMoneyReport } from './run'
import { buildPostingWorkbench, type PostingWorkbench } from './workbench'

/**
 * Found money straight from Tebra: a GetCharges pull already carries billed,
 * contract-expected and adjudicated amounts per line, so the Rung 0 diff runs on
 * it with no 835 file in the loop — and the posting workbench (what a biller
 * must do next) falls out of the same pull. Deterministic throughout.
 */

export interface TebraFoundMoney extends TebraCanonicalPull {
  feeSchedule: FeeSchedule
  report: FoundMoneyReport
  workbench: PostingWorkbench
}

/**
 * Tebra's contract rates win; `fallbackRates` (e.g. the practice's CSV) fill any
 * payer/code Tebra has no active contract for. `now` only drives aging notes.
 */
export async function runTebraFoundMoney(
  source: TebraSource,
  query: TebraChargeQuery,
  fallbackRates: FeeScheduleLine[] = [],
  now: Date = new Date(),
): Promise<TebraFoundMoney> {
  const pull = await pullTebraCanonical(source, query)
  const feeSchedule = new FeeSchedule([...fallbackRates, ...pull.feeScheduleLines]) // later lines override
  const report = runFoundMoneyFrom(pull.claims, pull.remittances, feeSchedule, 'tebra')
  const workbench = buildPostingWorkbench({ claims: pull.claims, findings: report.findings, tracking: pull.tracking, rates: feeSchedule }, now)
  return { ...pull, feeSchedule, report, workbench }
}
