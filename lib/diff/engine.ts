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
 * and emits findings: underpayments, denials (classified by CARC), and
 * undercoding flags.
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
    if (!remit) continue // nothing adjudicated to diff against yet

    const remitLines = indexRemitLines(remit.lines)

    for (const line of claim.lines) {
      const remitLine = remitLines.get(lineKey(line.cptHcpcs, line.modifiers))
      const contracted = rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0])

      if (remitLine) {
        const payment = paymentFinding(claim, line, remitLine, contracted, detectedAt)
        if (payment) findings.push(payment)
      }

      const undercoding = undercodingFinding(claim, line, rates, detectedAt)
      if (undercoding) findings.push(undercoding)
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
  // Denial: the line was not paid at all.
  if (remitLine.paidCents === 0) {
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

  // Underpayment: paid less than our contracted rate.
  if (contracted !== undefined && remitLine.paidCents < contracted) {
    const delta = contracted - remitLine.paidCents
    const co = remitLine.adjustments.find((a) => a.groupCode === 'CO')
    return {
      id: `underpayment:${line.id}`,
      type: 'underpayment',
      ...common(claim, line, detectedAt),
      expectedCents: contracted,
      actualCents: remitLine.paidCents,
      deltaCents: delta,
      recoverableCents: delta,
      appealable: true,
      status: 'open',
      carcCode: co?.carcCode,
      reason: `Paid ${formatCents(remitLine.paidCents)} against a contracted ${formatCents(
        contracted,
      )} — recover ${formatCents(delta)}.`,
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
