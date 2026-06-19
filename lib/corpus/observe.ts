import type { Claim, Remittance } from '../canonical'
import type { AdjudicatedObservation } from './types'
import { assertObservationClean } from './gate'

/**
 * The one-way de-id transform, stage 1: read PHI-bearing canonical claims +
 * remittances and emit de-identified observations. This is the gate. It reads a
 * patient's claim but copies forward ONLY non-identifying dimensions + money +
 * behavior. Dates are used transiently to compute a duration (days-to-pay) and
 * then dropped — no date reaches the observation. There is no inverse: you
 * cannot recover the patient from an observation.
 */

export interface ObserveDims {
  /** Coarse geography for these claims (the practice's state). Never an address. */
  region: string
  specialty: string
  /** Optional paid date per claim control number — used only to derive days-to-pay. */
  paidDateByClaim?: Record<string, string>
}

const MS_PER_DAY = 86_400_000

/** Bucket the filing indicator into a coarse, non-identifying contract class. */
function contractClassFor(filingCode?: string): string {
  switch (filingCode) {
    case 'MB':
      return 'medicare'
    case 'MC':
      return 'medicaid'
    case 'CI':
    case 'BL':
    case 'HM':
      return 'commercial'
    default:
      return 'other'
  }
}

const lineKey = (cpt: string, mods: string[]): string => `${cpt}|${[...mods].sort().join(',')}`

function daysBetween(dos?: string, paid?: string): number | null {
  if (!dos || !paid) return null
  const d = Math.floor((new Date(paid).getTime() - new Date(dos).getTime()) / MS_PER_DAY)
  return Number.isFinite(d) && d >= 0 ? d : null
}

export function observe(claims: Claim[], remittances: Remittance[], dims: ObserveDims): AdjudicatedObservation[] {
  const remitByClaim = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  const out: AdjudicatedObservation[] = []

  for (const claim of claims) {
    const remit = remitByClaim.get(claim.controlNumber)
    if (!remit) continue // not adjudicated yet — nothing to learn from
    const contractClass = contractClassFor(claim.claimFilingCode)
    const daysToPay = daysBetween(claim.dateOfService, dims.paidDateByClaim?.[claim.controlNumber])
    const remitLines = new Map(remit.lines.map((l) => [lineKey(l.cptHcpcs, l.modifiers), l]))

    for (const line of claim.lines) {
      const rl = remitLines.get(lineKey(line.cptHcpcs, line.modifiers))
      if (!rl) continue
      // Denied = paid nothing for a payer reason (PR is patient-owed, not a denial).
      const denied = rl.paidCents === 0 && rl.adjustments.some((a) => a.groupCode !== 'PR')
      out.push({
        payerExternalId: claim.payer.externalId,
        region: dims.region,
        specialty: dims.specialty,
        cptHcpcs: line.cptHcpcs,
        modifier: line.modifiers[0] ?? '',
        contractClass,
        billedCents: rl.billedCents,
        allowedCents: rl.allowedCents,
        paidCents: rl.paidCents,
        daysToPay,
        denied,
        carcCodes: rl.adjustments.map((a) => a.carcCode),
      })
    }
  }

  // Defense in depth: nothing identifier-shaped escaped into an observation.
  for (const o of out) assertObservationClean(o)
  return out
}
