import type { Remittance } from '../canonical'
import type { PriorPaid } from '../db/repository'
import { lineMatchKey } from '../db/mappers'

/**
 * Payment regressions — a payer took money back. Between two syncs a claim's
 * posted payment went DOWN (a reversal, a recoupment, an offset against a later
 * check). Vendor-neutral: it compares what we stored last time with what the PM
 * reports now, so it works on any source without knowing how that source
 * represents a takeback. Deterministic.
 */

export interface PaymentRegression {
  claimControlNumber: string
  /** Set when the drop is attributable to one line. */
  cptHcpcs?: string
  modifiers?: string[]
  previousPaidCents: number
  currentPaidCents: number
  /** Always negative: current − previous. */
  deltaCents: number
}

export function detectPaymentRegressions(previous: Map<string, PriorPaid>, current: Remittance[]): PaymentRegression[] {
  const out: PaymentRegression[] = []
  const currentByControl = new Map(current.map((r) => [r.claimControlNumber, r]))

  for (const [controlNumber, prior] of previous) {
    const remit = currentByControl.get(controlNumber)
    const currentTotal = remit?.totalPaidCents ?? 0
    if (currentTotal >= prior.totalPaidCents) continue

    // Attribute to lines where we can; otherwise report the claim as a whole.
    const currentLines = new Map<string, { paid: number; cpt: string; modifiers: string[] }>()
    for (const l of remit?.lines ?? []) {
      const key = lineMatchKey(l.cptHcpcs, l.modifiers)
      const prev = currentLines.get(key)
      currentLines.set(key, { paid: (prev?.paid ?? 0) + l.paidCents, cpt: l.cptHcpcs, modifiers: l.modifiers })
    }
    let attributed = 0
    for (const [key, prevPaid] of prior.lines) {
      const now = currentLines.get(key)
      const nowPaid = now?.paid ?? 0
      if (nowPaid < prevPaid) {
        const [cpt, mods] = key.split('|')
        out.push({
          claimControlNumber: controlNumber,
          cptHcpcs: now?.cpt ?? cpt,
          modifiers: now?.modifiers ?? (mods ? mods.split(',') : []),
          previousPaidCents: prevPaid,
          currentPaidCents: nowPaid,
          deltaCents: nowPaid - prevPaid,
        })
        attributed += prevPaid - nowPaid
      }
    }
    const unattributed = prior.totalPaidCents - currentTotal - attributed
    if (unattributed > 0) {
      out.push({ claimControlNumber: controlNumber, previousPaidCents: prior.totalPaidCents, currentPaidCents: currentTotal, deltaCents: -unattributed })
    }
  }

  return out.sort((a, b) => a.deltaCents - b.deltaCents || a.claimControlNumber.localeCompare(b.claimControlNumber))
}
