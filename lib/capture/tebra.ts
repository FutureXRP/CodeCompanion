import type { FeeScheduleLine } from '../canonical'
import { FeeSchedule } from '../adapters/fee-schedule'
import { pullTebraPending, type TebraCanonicalPull, type TebraChargeQuery, type TebraSource } from '../adapters/tebra'
import { reviewClaims } from './review'
import type { CaptureReport } from './types'

/**
 * Pre-approval review straight from Tebra: pull the Draft / Review encounters,
 * run the scrubber + capture rules against Tebra's own contract rates, and
 * report what to fix and what is missing before anyone clicks Approve.
 */

export interface TebraPreApproval extends TebraCanonicalPull {
  feeSchedule: FeeSchedule
  report: CaptureReport
}

/**
 * Tebra's contract rates (ExpectedAmount on the pending charges) win;
 * `fallbackRates` — the practice's contract export or CSV — supply rates for
 * codes that are not on any encounter yet (the add-ons the review can suggest).
 */
export async function runTebraPreApproval(
  source: TebraSource,
  query: Omit<TebraChargeQuery, 'includeUnapproved' | 'encounterStatus'>,
  fallbackRates: FeeScheduleLine[] = [],
  now: Date = new Date(),
): Promise<TebraPreApproval> {
  const pull = await pullTebraPending(source, query)
  const feeSchedule = new FeeSchedule([...fallbackRates, ...pull.feeScheduleLines]) // later lines override
  const report = reviewClaims(pull.claims, pull.tracking, { rates: feeSchedule, assembledBy: 'pm' }, now)
  return { ...pull, feeSchedule, report }
}
