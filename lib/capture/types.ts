import type { Claim } from '../canonical'
import type { RateLookup } from '../diff'

/**
 * Pre-approval review — the "capture the most out of every visit" layer.
 *
 * Runs on encounters that are documented but NOT yet approved/sent, and tells
 * the biller (or the provider) what to fix and what is missing before the claim
 * goes out: scrubber edits that would reject or deny, coding that the record
 * may support at a higher level, and separately payable services that are on
 * the chart but not on the encounter. DETERMINISTIC — rules and contract rates,
 * never an LLM (CLAUDE.md). It flags; a human changes the codes.
 */

/** blocker = will reject/deny as-is · warning = likely to deny or bundle · opportunity = separately payable if documented */
export type CaptureSeverity = 'blocker' | 'warning' | 'opportunity'
export type CaptureImpact = 'at_risk' | 'opportunity' | 'none'

export interface CaptureFinding {
  /** Deterministic id: `${code}:${claimLineId ?? claimControlNumber}`. */
  id: string
  claimControlNumber: string
  claimLineId?: string
  cptHcpcs?: string
  severity: CaptureSeverity
  /** Stable rule code: a scrubber edit code prefixed `SCRUB:`, or a `CAP-*` capture rule. */
  code: string
  title: string
  /** Deterministic, template-generated explanation. NEVER LLM-generated. */
  detail: string
  hint?: string
  impact: CaptureImpact
  /** Contracted dollars at risk (would be lost) or available (if documented). */
  impactCents: number
}

export type ReviewVerdict = 'blocked' | 'fix' | 'opportunities' | 'ready'
export type ApprovalStatus = 'draft' | 'review' | 'unknown'

export interface EncounterReview {
  claimControlNumber: string
  approvalStatus: ApprovalStatus
  verdict: ReviewVerdict
  findings: CaptureFinding[]
  /** Capped at the encounter's contracted value — a claim cannot lose more than it is worth. */
  atRiskCents: number
  opportunityCents: number
  /** Contracted value of the encounter as coded (billed charge where no rate is on file). */
  expectedCents: number
}

export interface CaptureTotals {
  encounters: number
  byVerdict: Record<ReviewVerdict, number>
  blockers: number
  warnings: number
  opportunities: number
  atRiskCents: number
  opportunityCents: number
  expectedCents: number
}

export interface CaptureReport {
  reviews: EncounterReview[]
  totals: CaptureTotals
  generatedAt: string
}

export interface ReviewContext {
  rates: RateLookup
  /**
   * Who assembles the 837: the practice-management system (which holds the
   * demographics itself) or CodeCompanion's own builder. Decides which
   * structural scrubber checks apply.
   */
  assembledBy: 'pm' | 'codecompanion'
}

/** A capture rule: pure function from a claim (+ rates) to findings. */
export type CaptureRule = (claim: Claim, ctx: ReviewContext) => CaptureFinding[]
