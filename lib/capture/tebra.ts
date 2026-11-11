import type { FeeScheduleLine } from '../canonical'
import { FeeSchedule } from '../adapters/fee-schedule'
import { pullTebraPending, pullTebraSchedule, type TebraAppointmentQuery, type TebraCanonicalPull, type TebraChargeQuery, type TebraSchedulePull, type TebraSource } from '../adapters/tebra'
import type { EditTables } from '../scrub'
import { reviewClaims } from './review'
import { reviewSchedule, type FrontDeskReport } from './frontdesk'
import type { CaptureReport } from './types'

export interface TebraFrontDesk extends TebraSchedulePull {
  report: FrontDeskReport
}

/** The front desk's morning: the schedule with coverage, reviewed. */
export async function runTebraFrontDesk(source: TebraSource, query: TebraAppointmentQuery, now: Date = new Date()): Promise<TebraFrontDesk> {
  const pull = await pullTebraSchedule(source, query)
  return { ...pull, report: reviewSchedule(pull.visits, now) }
}

/**
 * Pre-approval review straight from Tebra: pull the Draft / Review encounters,
 * run the scrubber + capture rules against Tebra's own contract rates, and
 * report what to fix and what is missing before anyone clicks Approve.
 */

export interface TebraPreApproval extends TebraCanonicalPull {
  feeSchedule: FeeSchedule
  report: CaptureReport
}

export interface PreApprovalOptions {
  /** The practice's contract export / CSV — rates for codes not on any encounter yet (the suggested add-ons). */
  fallbackRates?: FeeScheduleLine[]
  /** NCCI PTP + MUE tables; seed tables when omitted (see lib/scrub/load-tables). */
  edits?: EditTables
  now?: Date
}

/**
 * Tebra's contract rates (ExpectedAmount on the pending charges) win;
 * `fallbackRates` supply rates for codes that are not on any encounter yet.
 */
export async function runTebraPreApproval(
  source: TebraSource,
  query: Omit<TebraChargeQuery, 'includeUnapproved' | 'encounterStatus'>,
  fallbackRates: FeeScheduleLine[] = [],
  now: Date = new Date(),
  edits?: EditTables,
): Promise<TebraPreApproval> {
  const pull = await pullTebraPending(source, query)
  const feeSchedule = new FeeSchedule([...fallbackRates, ...pull.feeScheduleLines]) // later lines override
  const report = reviewClaims(pull.claims, pull.tracking, { rates: feeSchedule, assembledBy: 'pm', edits }, now)
  return { ...pull, feeSchedule, report }
}
