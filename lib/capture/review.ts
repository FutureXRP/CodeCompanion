import type { Claim, ClaimTracking } from '../canonical'
import { scrubClaim, OKLAHOMA } from '../scrub'
import { CAPTURE_RULES, claimExpected, lineRate } from './rules'
import type {
  ApprovalStatus,
  CaptureFinding,
  CaptureImpact,
  CaptureReport,
  CaptureSeverity,
  CaptureTotals,
  EncounterReview,
  ReviewContext,
  ReviewVerdict,
} from './types'

/**
 * Review an encounter before it is approved: the scrubber's edits (what would
 * reject or deny) plus the capture rules (what the record may support and what
 * is missing), each with the contracted dollars on it. DETERMINISTIC.
 */

/** Structural checks about CodeCompanion's own 837 assembly — moot when the PM system builds the claim from its own demographics. */
const SCRUB_NOT_APPLICABLE_WHEN_PM = new Set(['ADDR-REQUIRED'])

const SCRUB_TITLES: Record<string, string> = {
  'CCI-25': 'E/M needs modifier 25',
  'CCI-PTP': 'Bundled code pair',
  'EM-BUNDLED': 'Service bundled into the E/M',
  MUE: 'Units exceed the daily maximum',
  'DX-MISSING': 'No diagnosis on the claim',
  'DX-POINTER': 'Diagnosis pointer is broken',
  'DX-NONBILLABLE': 'Non-billable diagnosis code',
  'REQ-PAYER': 'Missing payer',
  'REQ-NPI': 'Missing provider NPI',
  'REQ-LINES': 'No service lines',
  'REQ-CHARGE': 'No charge on the claim',
  'REQ-CPT': 'Line is missing a code',
  'NPI-INVALID': 'Invalid NPI',
  'FREQ-ICN': 'Corrected claim without the original claim number',
  'DOS-FUTURE': 'Service date is in the future',
  'TELEHEALTH-MOD': 'Telehealth modifier missing',
}

const SEVERITY_ORDER: Record<CaptureSeverity, number> = { blocker: 0, warning: 1, opportunity: 2 }

/** The scrubber's findings as capture findings: errors block, warnings warn, info is dropped (not actionable for approval). */
export function scrubFindings(claim: Claim, ctx: ReviewContext): CaptureFinding[] {
  const result = scrubClaim(claim, OKLAHOMA)
  const out: CaptureFinding[] = []
  for (const f of result.findings) {
    if (f.severity === 'info') continue
    if (ctx.assembledBy === 'pm' && SCRUB_NOT_APPLICABLE_WHEN_PM.has(f.code)) continue
    const line = f.claimLineId ? claim.lines.find((l) => l.id === f.claimLineId) : undefined
    let impact: CaptureImpact = 'at_risk'
    let impactCents = 0
    if (f.code === 'EM-BUNDLED') {
      impact = 'none' // not payable either way — dropping it loses nothing
    } else if (line) {
      impactCents = lineRate(claim, line, ctx)
    } else if (f.severity === 'error') {
      impactCents = claimExpected(claim, ctx) // the whole claim rejects
    } else {
      impact = 'none'
    }
    out.push({
      id: `SCRUB:${f.code}:${f.claimLineId ?? claim.controlNumber}`,
      claimControlNumber: claim.controlNumber,
      claimLineId: f.claimLineId,
      cptHcpcs: f.cptHcpcs,
      severity: f.severity === 'error' ? 'blocker' : 'warning',
      code: `SCRUB:${f.code}`,
      title: SCRUB_TITLES[f.code] ?? f.code,
      detail: f.message,
      hint: f.hint,
      impact,
      impactCents,
    })
  }
  return out
}

export function reviewClaim(claim: Claim, approvalStatus: ApprovalStatus, ctx: ReviewContext): EncounterReview {
  let findings = [...scrubFindings(claim, ctx), ...CAPTURE_RULES.flatMap((rule) => rule(claim, ctx))]

  // The preventive-visit rule is the precise form of the generic modifier-25 advisory — keep one per line.
  const preventiveLines = new Set(findings.filter((f) => f.code === 'CAP-PREV-25').map((f) => f.claimLineId))
  findings = findings.filter((f) => !(f.code === 'SCRUB:CCI-25' && preventiveLines.has(f.claimLineId)))

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.impactCents - a.impactCents || a.id.localeCompare(b.id))

  const expectedCents = claimExpected(claim, ctx)
  const atRiskRaw = findings.filter((f) => f.impact === 'at_risk').reduce((s, f) => s + f.impactCents, 0)
  const atRiskCents = Math.min(expectedCents, atRiskRaw)
  const opportunityCents = findings.filter((f) => f.impact === 'opportunity').reduce((s, f) => s + f.impactCents, 0)

  const has = (s: CaptureSeverity) => findings.some((f) => f.severity === s)
  const verdict: ReviewVerdict = has('blocker') ? 'blocked' : has('warning') ? 'fix' : has('opportunity') ? 'opportunities' : 'ready'

  return { claimControlNumber: claim.controlNumber, approvalStatus, verdict, findings, atRiskCents, opportunityCents, expectedCents }
}

/** Approval state of a claim from its line tracking (draft wins over review; sent claims are 'unknown' here). */
export function approvalStatusOf(controlNumber: string, tracking: ClaimTracking[]): ApprovalStatus {
  const statuses = tracking.filter((t) => t.claimControlNumber === controlNumber).map((t) => t.status)
  if (statuses.includes('draft')) return 'draft'
  if (statuses.includes('review')) return 'review'
  return 'unknown'
}

export function reviewClaims(claims: Claim[], tracking: ClaimTracking[], ctx: ReviewContext, now: Date = new Date()): CaptureReport {
  const reviews = claims.map((c) => reviewClaim(c, approvalStatusOf(c.controlNumber, tracking), ctx))
  // Blocked first, then by dollars at stake (risk + opportunity), then the ready ones.
  const VERDICT_ORDER: Record<ReviewVerdict, number> = { blocked: 0, fix: 1, opportunities: 2, ready: 3 }
  reviews.sort(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
      b.atRiskCents + b.opportunityCents - (a.atRiskCents + a.opportunityCents) ||
      a.claimControlNumber.localeCompare(b.claimControlNumber),
  )

  const totals: CaptureTotals = {
    encounters: reviews.length,
    byVerdict: { blocked: 0, fix: 0, opportunities: 0, ready: 0 },
    blockers: 0,
    warnings: 0,
    opportunities: 0,
    atRiskCents: 0,
    opportunityCents: 0,
    expectedCents: 0,
  }
  for (const r of reviews) {
    totals.byVerdict[r.verdict] += 1
    totals.atRiskCents += r.atRiskCents
    totals.opportunityCents += r.opportunityCents
    totals.expectedCents += r.expectedCents
    for (const f of r.findings) {
      if (f.severity === 'blocker') totals.blockers += 1
      else if (f.severity === 'warning') totals.warnings += 1
      else totals.opportunities += 1
    }
  }
  return { reviews, totals, generatedAt: now.toISOString() }
}
