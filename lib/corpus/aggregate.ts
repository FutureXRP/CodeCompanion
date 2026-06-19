import type { AdjudicatedObservation, CorpusResult, CorpusRow } from './types'
import { distribution } from './stats'
import { MIN_SAMPLE_N, assertDeidentified } from './gate'

/**
 * The de-id transform, stage 2: bucket observations by their non-identifying
 * dimensions and emit one aggregate CorpusRow per cell — but ONLY for cells with
 * enough samples to be safely de-identified. Small cells are suppressed (a single
 * patient's behavior must never be inferable). Every emitted row passes the gate.
 */

// Control-char separator that cannot occur in a dimension value (avoids key collisions).
const DIM_SEP = ''
const keyOf = (o: AdjudicatedObservation): string =>
  [o.payerExternalId, o.region, o.specialty, o.cptHcpcs, o.modifier, o.contractClass].join(DIM_SEP)

function topCarcCodes(group: AdjudicatedObservation[], limit = 3): string[] {
  const counts = new Map<string, number>()
  for (const o of group) for (const c of o.carcCodes) counts.set(c, (counts.get(c) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([c]) => c)
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export function aggregate(observations: AdjudicatedObservation[], minSampleN: number = MIN_SAMPLE_N): CorpusResult {
  const groups = new Map<string, AdjudicatedObservation[]>()
  for (const o of observations) {
    const k = keyOf(o)
    const bucket = groups.get(k)
    if (bucket) bucket.push(o)
    else groups.set(k, [o])
  }

  const rows: CorpusRow[] = []
  let suppressed = 0

  for (const group of groups.values()) {
    if (group.length < minSampleN) {
      suppressed += 1 // small-cell suppression — too few to de-identify safely
      continue
    }
    const s = group[0]
    const days = group.map((g) => g.daysToPay).filter((d): d is number => d !== null)
    const row: CorpusRow = {
      payerExternalId: s.payerExternalId,
      region: s.region,
      specialty: s.specialty,
      cptHcpcs: s.cptHcpcs,
      modifier: s.modifier,
      contractClass: s.contractClass,
      allowedStat: distribution(group.map((g) => g.allowedCents)),
      paidStat: distribution(group.map((g) => g.paidCents)),
      daysToPayStat: days.length ? distribution(days) : null,
      denialRate: round2(group.filter((g) => g.denied).length / group.length),
      topCarcCodes: topCarcCodes(group),
      sampleN: group.length,
    }
    // The gate: nothing reaches the corpus without passing it.
    assertDeidentified(row)
    rows.push(row)
  }

  return { rows, suppressed, observations: observations.length }
}
