import type { Cents } from '../canonical'
import type { Receivable } from './types'

/**
 * Accounts-receivable aging — the report every office manager lives in.
 *
 * Buckets outstanding A/R by age, split insurance vs patient, and computes the
 * over-90 share and Days in A/R (DAR). DETERMINISTIC: every figure is a sum or a
 * ratio of the inputs — no LLM, reproducible (CLAUDE.md). Older money is harder
 * to collect, so the over-90 bucket and DAR are the headline collection signals.
 */

export interface AgingBucketDef {
  key: string
  label: string
  minDays: number
  maxDays: number
}

export const AGING_BUCKETS: AgingBucketDef[] = [
  { key: '0-30', label: '0–30 days', minDays: 0, maxDays: 30 },
  { key: '31-60', label: '31–60 days', minDays: 31, maxDays: 60 },
  { key: '61-90', label: '61–90 days', minDays: 61, maxDays: 90 },
  { key: '91-120', label: '91–120 days', minDays: 91, maxDays: 120 },
  { key: '120+', label: '120+ days', minDays: 121, maxDays: Number.POSITIVE_INFINITY },
]

const OVER_90_MIN_DAYS = 91

export interface AgingBucket {
  key: string
  label: string
  insuranceArCents: Cents
  patientArCents: Cents
  totalCents: Cents
  count: number
  /** Share of total A/R in this bucket (0..1). */
  pctOfTotal: number
}

export interface PayerAr {
  payerName: string
  payerExternalId: string
  insuranceArCents: Cents
  patientArCents: Cents
  totalCents: Cents
  over90Cents: Cents
  count: number
}

export interface ArAgingReport {
  asOf: string
  buckets: AgingBucket[]
  byPayer: PayerAr[]
  totals: {
    insuranceArCents: Cents
    patientArCents: Cents
    totalCents: Cents
    over90Cents: Cents
    count: number
  }
  /** Share of total A/R aged over 90 days (0..1). */
  over90Pct: number
  /** Days in A/R: total A/R ÷ average daily charges. The cash-velocity headline. */
  darDays: number
}

const MS_PER_DAY = 86_400_000

/** Whole days between a service date and the as-of moment (never negative). */
export function ageInDays(dateOfService: string, asOf: Date): number {
  const dos = new Date(`${dateOfService}T00:00:00Z`).getTime()
  if (Number.isNaN(dos)) return 0
  const days = Math.floor((asOf.getTime() - dos) / MS_PER_DAY)
  return days < 0 ? 0 : days
}

export function bucketForAge(days: number): AgingBucketDef {
  return AGING_BUCKETS.find((b) => days >= b.minDays && days <= b.maxDays) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1]
}

export function buildArAging(
  receivables: Receivable[],
  opts: { asOf?: Date; avgDailyChargeCents: Cents },
): ArAgingReport {
  const asOf = opts.asOf ?? new Date()

  const buckets = new Map<string, AgingBucket>(
    AGING_BUCKETS.map((b) => [b.key, { key: b.key, label: b.label, insuranceArCents: 0, patientArCents: 0, totalCents: 0, count: 0, pctOfTotal: 0 }]),
  )
  const payers = new Map<string, PayerAr>()

  let insuranceArCents = 0
  let patientArCents = 0
  let over90Cents = 0

  for (const r of receivables) {
    const total = r.insuranceArCents + r.patientArCents
    if (total === 0) continue
    const days = ageInDays(r.dateOfService, asOf)
    const bucket = buckets.get(bucketForAge(days).key)!
    bucket.insuranceArCents += r.insuranceArCents
    bucket.patientArCents += r.patientArCents
    bucket.totalCents += total
    bucket.count += 1

    const payer = payers.get(r.payerExternalId) ?? {
      payerName: r.payerName, payerExternalId: r.payerExternalId,
      insuranceArCents: 0, patientArCents: 0, totalCents: 0, over90Cents: 0, count: 0,
    }
    payer.insuranceArCents += r.insuranceArCents
    payer.patientArCents += r.patientArCents
    payer.totalCents += total
    payer.count += 1
    if (days >= OVER_90_MIN_DAYS) payer.over90Cents += total
    payers.set(r.payerExternalId, payer)

    insuranceArCents += r.insuranceArCents
    patientArCents += r.patientArCents
    if (days >= OVER_90_MIN_DAYS) over90Cents += total
  }

  const totalCents = insuranceArCents + patientArCents
  const bucketList = AGING_BUCKETS.map((b) => {
    const x = buckets.get(b.key)!
    return { ...x, pctOfTotal: totalCents === 0 ? 0 : x.totalCents / totalCents }
  })

  return {
    asOf: asOf.toISOString(),
    buckets: bucketList,
    byPayer: [...payers.values()].sort((a, b) => b.totalCents - a.totalCents),
    totals: { insuranceArCents, patientArCents, totalCents, over90Cents, count: receivables.filter((r) => r.insuranceArCents + r.patientArCents > 0).length },
    over90Pct: totalCents === 0 ? 0 : over90Cents / totalCents,
    darDays: opts.avgDailyChargeCents > 0 ? Math.round(totalCents / opts.avgDailyChargeCents) : 0,
  }
}
