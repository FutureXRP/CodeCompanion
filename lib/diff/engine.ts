import type {
  Adjustment,
  Claim,
  ClaimLine,
  Finding,
  Remittance,
  RemittanceLine,
} from '../canonical'
import { formatCents } from '../canonical'
import { classifyCarc, type CarcInfo } from './carc'

/**
 * The Rung 0 diff engine.
 *
 * DETERMINISTIC. No LLM ever touches this path — every dollar figure here must
 * be auditable and reproducible (CLAUDE.md). It joins, per line:
 *   837 sent  ↔  835 paid  ↔  contracted rate
 * and emits findings: underpayments, denials (classified by CARC), undercoding
 * flags, and unadjudicated lines (837 sent, no 835 back) at timely-filing risk.
 */

/** The diff depends only on this rate-lookup shape, never on the fee-schedule adapter. */
export interface RateLookup {
  rate(payerExternalId: string, cptHcpcs: string, modifier?: string): number | undefined
}

/** Conservative one-level upcode map for E/M office visits. */
const UPCODE_MAP: Record<string, string> = {
  '99202': '99203',
  '99203': '99204',
  '99212': '99213',
  '99213': '99214',
}
const UNDERCODING_MIN_DIAGNOSES = 4
const UNDERCODING_MIN_LINES = 2

/** Conservative default filing window; real limits are payer-specific (90–365d). */
const TIMELY_FILING_LIMIT_DAYS = 365
const FILING_WARNING_WINDOW_DAYS = 90
const MS_PER_DAY = 86_400_000

type FindingCommon = Pick<
  Finding,
  | 'claimControlNumber'
  | 'claimLineId'
  | 'payerName'
  | 'payerExternalId'
  | 'cptHcpcs'
  | 'modifiers'
  | 'dateOfService'
  | 'detectedAt'
>

export function runDiff(
  claims: Claim[],
  remittances: Remittance[],
  rates: RateLookup,
  now: Date = new Date(),
): Finding[] {
  const detectedAt = now.toISOString()
  const remitByClaim = new Map<string, Remittance>()
  for (const remit of remittances) remitByClaim.set(remit.claimControlNumber, remit)

  const findings: Finding[] = []

  for (const claim of claims) {
    const remit = remitByClaim.get(claim.controlNumber)
    const remitLines = remit ? indexRemitLines(remit.lines) : null

    for (const line of claim.lines) {
      const contracted = rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0])
      const remitLine = remitLines?.get(lineKey(line.cptHcpcs, line.modifiers))

      if (remitLine) {
        const payment = paymentFinding(claim, line, remitLine, contracted, detectedAt)
        if (payment) findings.push(payment)

        // Undercoding only applies to a line that was actually adjudicated.
        const undercoding = undercodingFinding(claim, line, rates, detectedAt)
        if (undercoding) findings.push(undercoding)
      } else {
        // 837 sent, but no 835 line for it — either the whole claim was never
        // adjudicated, or the payer dropped this line. Money silently at risk of
        // a timely-filing write-off until someone chases it.
        findings.push(unadjudicatedFinding(claim, line, contracted, now, detectedAt))
      }
    }
  }

  return findings.sort((a, b) => b.recoverableCents - a.recoverableCents)
}

function paymentFinding(
  claim: Claim,
  line: ClaimLine,
  remitLine: RemittanceLine,
  contracted: number | undefined,
  detectedAt: string,
): Finding | null {
  // Denial: the payer paid nothing AND the reason is a payer adjustment, not
  // pure patient responsibility (an unmet deductible is patient-owed, not a denial).
  const hasPayerDenial = remitLine.adjustments.some((a) => a.groupCode !== 'PR')
  if (remitLine.paidCents === 0 && hasPayerDenial) {
    const primary = primaryAdjustment(remitLine)
    const info = primary ? classifyCarc(primary.carcCode) : undefined
    const appealable = info?.appealable ?? true
    const expected = contracted ?? remitLine.billedCents
    return {
      id: `denial:${line.id}`,
      type: 'denial',
      ...common(claim, line, detectedAt),
      expectedCents: expected,
      actualCents: 0,
      deltaCents: expected,
      recoverableCents: appealable ? expected : 0,
      appealable,
      status: appealable ? 'open' : 'terminal',
      carcCode: primary?.carcCode,
      reason: denialReason(info, expected, appealable),
    }
  }

  // Underpayment: payer paid less than contracted, after crediting legitimate
  // patient responsibility (coinsurance/deductible/copay) toward the contract.
  if (contracted !== undefined) {
    const shortfall = contracted - remitLine.paidCents - remitLine.patientRespCents
    if (shortfall > 0) {
      const co = remitLine.adjustments.find((a) => a.groupCode === 'CO')
      return {
        id: `underpayment:${line.id}`,
        type: 'underpayment',
        ...common(claim, line, detectedAt),
        expectedCents: contracted,
        actualCents: remitLine.paidCents,
        deltaCents: contracted - remitLine.paidCents,
        recoverableCents: shortfall,
        appealable: true,
        status: 'open',
        carcCode: co?.carcCode,
        reason:
          remitLine.patientRespCents > 0
            ? `Payer paid ${formatCents(remitLine.paidCents)}, patient owes ${formatCents(
                remitLine.patientRespCents,
              )}, vs contracted ${formatCents(contracted)} — recover ${formatCents(shortfall)} from payer.`
            : `Paid ${formatCents(remitLine.paidCents)} against a contracted ${formatCents(
                contracted,
              )} — recover ${formatCents(shortfall)}.`,
      }
    }
  }

  return null
}

function undercodingFinding(
  claim: Claim,
  line: ClaimLine,
  rates: RateLookup,
  detectedAt: string,
): Finding | null {
  const next = UPCODE_MAP[line.cptHcpcs]
  if (!next) return null

  const diagnoses = Math.max(line.diagnosisPointers.length, claim.diagnoses.length)
  if (diagnoses < UNDERCODING_MIN_DIAGNOSES) return null
  if (claim.lines.length < UNDERCODING_MIN_LINES) return null

  const current = rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0])
  const upgraded = rates.rate(claim.payer.externalId, next)
  if (current === undefined || upgraded === undefined || upgraded <= current) return null

  const delta = upgraded - current
  return {
    id: `undercoding:${line.id}`,
    type: 'undercoding',
    ...common(claim, line, detectedAt),
    expectedCents: upgraded,
    actualCents: current,
    deltaCents: delta,
    recoverableCents: delta,
    appealable: false,
    status: 'open',
    reason: `${line.cptHcpcs} billed with ${diagnoses} diagnoses across ${claim.lines.length} service lines — documentation may support ${next} (+${formatCents(
      delta,
    )}). Requires chart review before re-coding.`,
  }
}

/**
 * Submitted-but-unadjudicated line: an 837 went out and no 835 line came back.
 * The recoverable figure is contracted (or billed, if no rate is on file) — this
 * is revenue that ages into a permanent timely-filing write-off if nobody acts.
 * Date-independent dollars; only the urgency note ages with `now`.
 */
function unadjudicatedFinding(
  claim: Claim,
  line: ClaimLine,
  contracted: number | undefined,
  now: Date,
  detectedAt: string,
): Finding {
  const expected = contracted ?? line.billedCents
  const risk = filingRisk(claim.dateOfService, now)
  const aged = risk.days !== null ? ` (${risk.days} days since DOS)` : ''
  const basis = contracted === undefined ? ' billed; no contracted rate on file' : ' contracted'
  return {
    id: `unadjudicated:${line.id}`,
    type: 'unadjudicated',
    ...common(claim, line, detectedAt),
    expectedCents: expected,
    actualCents: 0,
    deltaCents: expected,
    recoverableCents: expected,
    appealable: false,
    status: 'open',
    reason: `837 submitted, no remittance on file${aged}. ${risk.note} Expected ${formatCents(
      expected,
    )}${basis}.`,
  }
}

/** Deterministic timely-filing aging. Drives the urgency note, never the dollars. */
function filingRisk(dateOfService: string | undefined, now: Date): { days: number | null; note: string } {
  if (!dateOfService) {
    return { days: null, note: 'No service date on file to age against — confirm the payer received it.' }
  }
  const days = Math.floor((now.getTime() - new Date(dateOfService).getTime()) / MS_PER_DAY)
  if (days > TIMELY_FILING_LIMIT_DAYS) {
    return { days, note: `Past the ${TIMELY_FILING_LIMIT_DAYS}-day timely-filing window — at risk of permanent write-off unless reopened; act now.` }
  }
  if (days > TIMELY_FILING_LIMIT_DAYS - FILING_WARNING_WINDOW_DAYS) {
    return { days, note: `Within ${FILING_WARNING_WINDOW_DAYS} days of the ${TIMELY_FILING_LIMIT_DAYS}-day filing deadline — resubmit before it ages out.` }
  }
  return { days, note: 'Awaiting adjudication — follow up so it is not lost.' }
}

function common(claim: Claim, line: ClaimLine, detectedAt: string): FindingCommon {
  return {
    claimControlNumber: claim.controlNumber,
    claimLineId: line.id,
    payerName: claim.payer.name,
    payerExternalId: claim.payer.externalId,
    cptHcpcs: line.cptHcpcs,
    modifiers: line.modifiers,
    dateOfService: claim.dateOfService,
    detectedAt,
  }
}

function denialReason(info: CarcInfo | undefined, expected: number, appealable: boolean): string {
  const head = info ? `CARC ${info.code} — ${info.description}` : 'Line denied'
  const tail = appealable
    ? `Appealable; up to ${formatCents(expected)} recoverable.`
    : 'Classified terminal; review before writing off.'
  return `${head}. ${tail}`
}

function primaryAdjustment(remitLine: RemittanceLine): Adjustment | undefined {
  const nonPatient = remitLine.adjustments.filter((a) => a.groupCode !== 'PR')
  const pool = nonPatient.length ? nonPatient : remitLine.adjustments
  return pool.slice().sort((a, b) => b.amountCents - a.amountCents)[0]
}

function lineKey(cptHcpcs: string, modifiers: string[]): string {
  return `${cptHcpcs}|${modifiers.slice().sort().join(',')}`
}

function indexRemitLines(lines: RemittanceLine[]): Map<string, RemittanceLine> {
  const map = new Map<string, RemittanceLine>()
  for (const line of lines) map.set(lineKey(line.cptHcpcs, line.modifiers), line)
  return map
}
