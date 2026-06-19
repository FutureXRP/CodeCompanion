import type { Cents } from '../canonical'
import { classifyCarc, type CarcCategory } from '../diff/carc'
import type { DenialRecord } from './types'

/**
 * Denial analytics — where the money is leaking and how much of it is winnable.
 *
 * Rolls denials up by CARC reason and by payer, classifying each reason with the
 * shared HIPAA CARC table (the same one the diff engine uses), so "appealable"
 * dollars are the deterministic recovery opportunity. No LLM produces a figure
 * here; appeal *letters* are drafted by Claude elsewhere, never the numbers.
 */

export interface CarcBreakdown {
  carcCode: string
  description: string
  category: CarcCategory
  appealable: boolean
  count: number
  deniedCents: Cents
  /** Denied dollars on appealable reasons — recoverable via appeal. */
  appealableCents: Cents
  /** Share of total denied dollars (0..1). */
  pctOfDenied: number
}

export interface PayerDenial {
  payerName: string
  payerExternalId: string
  count: number
  deniedCents: Cents
  appealableCents: Cents
}

export interface DenialAnalyticsReport {
  totalDeniedCents: Cents
  /** Denial line/record count. */
  deniedCount: number
  /** Distinct claims with at least one denial. */
  deniedClaimCount: number
  appealableCents: Cents
  appealableCount: number
  /** Denied claims ÷ total claims in the period (0..1). */
  denialRate: number
  byCarc: CarcBreakdown[]
  byPayer: PayerDenial[]
}

export function buildDenialAnalytics(denials: DenialRecord[], totalClaims: number): DenialAnalyticsReport {
  const byCarc = new Map<string, CarcBreakdown>()
  const byPayer = new Map<string, PayerDenial>()
  const deniedClaims = new Set<string>()

  let totalDeniedCents = 0
  let appealableCents = 0
  let appealableCount = 0

  for (const d of denials) {
    const info = classifyCarc(d.carcCode)
    const appealablePortion = info.appealable ? d.deniedCents : 0
    totalDeniedCents += d.deniedCents
    appealableCents += appealablePortion
    if (info.appealable) appealableCount += 1
    deniedClaims.add(d.claimControlNumber)

    const carc = byCarc.get(d.carcCode) ?? {
      carcCode: d.carcCode, description: info.description, category: info.category, appealable: info.appealable,
      count: 0, deniedCents: 0, appealableCents: 0, pctOfDenied: 0,
    }
    carc.count += 1
    carc.deniedCents += d.deniedCents
    carc.appealableCents += appealablePortion
    byCarc.set(d.carcCode, carc)

    const payer = byPayer.get(d.payerExternalId) ?? {
      payerName: d.payerName, payerExternalId: d.payerExternalId, count: 0, deniedCents: 0, appealableCents: 0,
    }
    payer.count += 1
    payer.deniedCents += d.deniedCents
    payer.appealableCents += appealablePortion
    byPayer.set(d.payerExternalId, payer)
  }

  const carcList = [...byCarc.values()]
    .map((c) => ({ ...c, pctOfDenied: totalDeniedCents === 0 ? 0 : c.deniedCents / totalDeniedCents }))
    .sort((a, b) => b.deniedCents - a.deniedCents)

  return {
    totalDeniedCents,
    deniedCount: denials.length,
    deniedClaimCount: deniedClaims.size,
    appealableCents,
    appealableCount,
    denialRate: totalClaims > 0 ? deniedClaims.size / totalClaims : 0,
    byCarc: carcList,
    byPayer: [...byPayer.values()].sort((a, b) => b.deniedCents - a.deniedCents),
  }
}
