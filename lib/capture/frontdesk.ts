import type { ScheduledVisit } from '../canonical'
import { formatCents } from '../canonical'

/**
 * Front-desk review — what to catch BEFORE the patient is in the room, from the
 * schedule and the coverage the PM holds: no insurance on a billable case,
 * coverage that has ended or not started, an authorization that is expired or
 * used up, the copay to collect, a balance to settle. DETERMINISTIC: dates and
 * dollars from the PM, never an estimate.
 *
 * Real-time eligibility (270/271) is the PM's own check — Tebra runs it against
 * its clearinghouse; this layer works from what is on file and tells the desk
 * when that is not enough.
 */

export type FrontDeskSeverity = 'blocker' | 'warning' | 'info'

export interface FrontDeskFlag {
  id: string
  visitId: string
  severity: FrontDeskSeverity
  code: string
  title: string
  detail: string
  /** Dollars to collect at check-in (copay, balance), when the flag is about money. */
  amountCents?: number
}

export interface VisitReview {
  visit: ScheduledVisit
  flags: FrontDeskFlag[]
  /** Copay + open balance — what the desk should ask for. */
  collectCents: number
  /** Nothing to catch. */
  ready: boolean
}

export interface FrontDeskReport {
  reviews: VisitReview[]
  totals: {
    visits: number
    /** Visits still expected (not cancelled / rescheduled / no-show). */
    expected: number
    blockers: number
    warnings: number
    collectCents: number
    copaysCents: number
    balancesCents: number
    ready: number
  }
  generatedAt: string
}

const SELF_PAY = /self|cash|uninsured/i
const AUTH_REQUIRED = /workers|comp\b|auto|liability/i
const AUTH_WARNING_DAYS = 14
const MS_PER_DAY = 86_400_000

const skipped = (v: ScheduledVisit) => v.status === 'cancelled' || v.status === 'rescheduled' || v.status === 'no_show'

export function reviewVisit(visit: ScheduledVisit): VisitReview {
  const flags: FrontDeskFlag[] = []
  const flag = (severity: FrontDeskSeverity, code: string, title: string, detail: string, amountCents?: number) =>
    flags.push({ id: `${code}:${visit.id}`, visitId: visit.id, severity, code, title, detail, ...(amountCents ? { amountCents } : {}) })

  if (skipped(visit)) return { visit, flags, collectCents: 0, ready: true }

  const selfPay = SELF_PAY.test(visit.payerScenario ?? '')
  const primary = visit.coverage.find((c) => c.sequence === 'P') ?? visit.coverage[0]
  const day = visit.date

  // 1. Coverage on file for a billable case
  if (!primary && !selfPay) {
    flag('blocker', 'FD-NO-COVERAGE', 'No insurance on file', `The case is ${visit.payerScenario ?? 'billable'} but no policy is entered — get the card and run eligibility before the visit, or treat as self-pay.`)
  }
  if (primary) {
    if (primary.effectiveEnd && day && primary.effectiveEnd < day) {
      flag('blocker', 'FD-COVERAGE-ENDED', `${primary.payer.name} coverage ended ${primary.effectiveEnd}`, 'The policy on file ended before this visit — ask for current insurance and run eligibility, or the claim will deny for no coverage.')
    } else if (primary.effectiveStart && day && primary.effectiveStart > day) {
      flag('warning', 'FD-COVERAGE-NOT-STARTED', `${primary.payer.name} coverage starts ${primary.effectiveStart}`, 'The policy on file is not yet effective on the visit date — confirm the dates with the payer.')
    }
    if (!primary.memberId) flag('warning', 'FD-NO-MEMBER-ID', `${primary.payer.name} policy has no member number`, 'A claim without the member id rejects — copy it from the card.')
  }

  // 2. Authorizations
  const auths = visit.authorizations
  const linked = visit.authorizationNumber ? auths.find((a) => a.number === visit.authorizationNumber) : undefined
  if (visit.authorizationNumber || auths.length > 0) {
    const a = linked ?? auths[0]
    const authEnd = a?.endDate ?? visit.authorizationEnd
    if (authEnd && day && authEnd < day) {
      flag('blocker', 'FD-AUTH-EXPIRED', `Authorization ${a?.number ?? visit.authorizationNumber} expired ${authEnd}`, 'The visit is outside the authorization window — get a new authorization before the patient is seen.')
    } else if (authEnd && day && daysBetween(day, authEnd) <= AUTH_WARNING_DAYS) {
      flag('warning', 'FD-AUTH-ENDING', `Authorization ${a?.number ?? ''} ends ${authEnd}`, 'Request the extension now so the next visit is covered.')
    }
    if (a?.visitsAuthorized !== undefined && a.visitsUsed !== undefined && a.visitsUsed >= a.visitsAuthorized) {
      flag('blocker', 'FD-AUTH-EXHAUSTED', `Authorization ${a.number}: ${a.visitsUsed} of ${a.visitsAuthorized} visits used`, 'No authorized visits remain — this one will deny unless the payer extends it.')
    }
  } else if (AUTH_REQUIRED.test(visit.payerScenario ?? '')) {
    flag('warning', 'FD-AUTH-MISSING', `${visit.payerScenario} visit with no authorization on file`, 'Workers comp / auto / liability payers almost always require an authorization or claim number — confirm before the visit.')
  }

  // 3. Money to collect
  let collect = 0
  if (primary?.copayCents) {
    collect += primary.copayCents
    flag('info', 'FD-COPAY', `Collect ${formatCents(primary.copayCents)} copay`, `${primary.payer.name}${primary.planName ? ` · ${primary.planName}` : ''} — copay on file; collect at check-in.`, primary.copayCents)
  }
  if (visit.patientBalanceCents) {
    collect += visit.patientBalanceCents
    flag('info', 'FD-BALANCE', `Patient owes ${formatCents(visit.patientBalanceCents)}`, 'Open balance on the account — settle it or set up a plan while the patient is here.', visit.patientBalanceCents)
  }

  const ready = !flags.some((f) => f.severity !== 'info')
  return { visit, flags, collectCents: collect, ready }
}

export function reviewSchedule(visits: ScheduledVisit[], now: Date = new Date()): FrontDeskReport {
  const reviews = visits.map(reviewVisit)
  const live = reviews.filter((r) => !skipped(r.visit))
  const totals = {
    visits: reviews.length,
    expected: live.length,
    blockers: live.reduce((s, r) => s + r.flags.filter((f) => f.severity === 'blocker').length, 0),
    warnings: live.reduce((s, r) => s + r.flags.filter((f) => f.severity === 'warning').length, 0),
    collectCents: live.reduce((s, r) => s + r.collectCents, 0),
    copaysCents: live.reduce((s, r) => s + r.flags.filter((f) => f.code === 'FD-COPAY').reduce((x, f) => x + (f.amountCents ?? 0), 0), 0),
    balancesCents: live.reduce((s, r) => s + r.flags.filter((f) => f.code === 'FD-BALANCE').reduce((x, f) => x + (f.amountCents ?? 0), 0), 0),
    ready: live.filter((r) => r.ready).length,
  }
  return { reviews, totals, generatedAt: now.toISOString() }
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / MS_PER_DAY)
}
