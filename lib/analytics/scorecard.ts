import type { FindingStatus, FindingType } from '../canonical'

/**
 * The scorecard — the practice's revenue cycle in a handful of numbers, from
 * the persisted runs: what was billed and paid, how often the payer said no or
 * nothing, and what is still recoverable. Built from stored rows or from an
 * in-memory run alike; by payer and by month of service. DETERMINISTIC.
 *
 * This is the yardstick for a PM switch: run it on the 90 days before and the
 * 90 days after, and the numbers say whether the move paid off.
 */

export interface ScorecardClaim {
  controlNumber: string
  dateOfService?: string | null
  payerName: string
  billedCents: number
  paidCents: number
  /** A remittance was posted for it. */
  adjudicated: boolean
}

export interface ScorecardFinding {
  controlNumber: string
  dateOfService?: string | null
  type: FindingType
  status: FindingStatus
  recoverableCents: number
  appealable: boolean
}

export interface ScorecardBucket {
  key: string
  claims: number
  billedCents: number
  paidCents: number
  denials: number
  unanswered: number
  openRecoverableCents: number
}

export interface Scorecard {
  totals: {
    claims: number
    billedCents: number
    paidCents: number
    /** paid ÷ billed. */
    grossCollectionRate: number
    adjudicatedRate: number
    /** Claims with at least one denial finding ÷ claims. */
    denialRate: number
    /** Claims with at least one unanswered line ÷ claims. */
    unansweredRate: number
    openRecoverableCents: number
    appealingCents: number
    recoveredCents: number
    appealableDenialCents: number
    openFindings: number
  }
  byPayer: ScorecardBucket[]
  byMonth: ScorecardBucket[]
}

const OPEN: FindingStatus[] = ['open', 'appealing']
const ratio = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 10000)
const monthOf = (dos?: string | null) => (dos && /^\d{4}-\d{2}/.test(dos) ? dos.slice(0, 7) : 'unknown')

export function buildScorecard(claims: ScorecardClaim[], findings: ScorecardFinding[]): Scorecard {
  const denied = new Set(findings.filter((f) => f.type === 'denial').map((f) => f.controlNumber))
  const unanswered = new Set(findings.filter((f) => f.type === 'unadjudicated').map((f) => f.controlNumber))
  const open = findings.filter((f) => OPEN.includes(f.status))
  const openByClaim = new Map<string, number>()
  for (const f of open) openByClaim.set(f.controlNumber, (openByClaim.get(f.controlNumber) ?? 0) + f.recoverableCents)

  const bucket = (keyOf: (c: ScorecardClaim) => string): ScorecardBucket[] => {
    const map = new Map<string, ScorecardBucket>()
    for (const c of claims) {
      const key = keyOf(c)
      const b = map.get(key) ?? { key, claims: 0, billedCents: 0, paidCents: 0, denials: 0, unanswered: 0, openRecoverableCents: 0 }
      b.claims += 1
      b.billedCents += c.billedCents
      b.paidCents += c.paidCents
      if (denied.has(c.controlNumber)) b.denials += 1
      if (unanswered.has(c.controlNumber)) b.unanswered += 1
      b.openRecoverableCents += openByClaim.get(c.controlNumber) ?? 0
      map.set(key, b)
    }
    return [...map.values()]
  }

  const billedCents = claims.reduce((s, c) => s + c.billedCents, 0)
  const paidCents = claims.reduce((s, c) => s + c.paidCents, 0)
  return {
    totals: {
      claims: claims.length,
      billedCents,
      paidCents,
      grossCollectionRate: ratio(paidCents, billedCents),
      adjudicatedRate: ratio(claims.filter((c) => c.adjudicated).length, claims.length),
      denialRate: ratio(claims.filter((c) => denied.has(c.controlNumber)).length, claims.length),
      unansweredRate: ratio(claims.filter((c) => unanswered.has(c.controlNumber)).length, claims.length),
      openRecoverableCents: open.reduce((s, f) => s + f.recoverableCents, 0),
      appealingCents: findings.filter((f) => f.status === 'appealing').reduce((s, f) => s + f.recoverableCents, 0),
      recoveredCents: findings.filter((f) => f.status === 'recovered').reduce((s, f) => s + f.recoverableCents, 0),
      appealableDenialCents: open.filter((f) => f.type === 'denial' && f.appealable).reduce((s, f) => s + f.recoverableCents, 0),
      openFindings: open.length,
    },
    byPayer: bucket((c) => c.payerName || 'Unknown payer').sort((a, b) => b.billedCents - a.billedCents || a.key.localeCompare(b.key)),
    byMonth: bucket((c) => monthOf(c.dateOfService)).sort((a, b) => a.key.localeCompare(b.key)),
  }
}
