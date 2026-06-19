import type { AdjudicatedObservation } from './types'

/**
 * Synthetic de-identified observations for the demo + tests — no PHI by
 * construction (these are already aggregated payer behavior, not claims). Used to
 * show the corpus shape with cells above the suppression floor, plus one cell
 * deliberately too small (it gets suppressed).
 */

// Deterministic PRNG (mulberry32) so the demo and tests are reproducible.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface CellSpec {
  payer: string
  cpt: string
  contractClass: string
  n: number
  allowed: number
  paid: number
  days: number
  denialRate: number
  seed: number
}

function cell(spec: CellSpec): AdjudicatedObservation[] {
  const r = rng(spec.seed)
  const jitter = (x: number): number => Math.round(x * (0.9 + r() * 0.2))
  // Deterministic denials (every Kth line) so the demo + stats are reproducible.
  const everyK = spec.denialRate > 0 ? Math.max(2, Math.round(1 / spec.denialRate)) : 0
  const out: AdjudicatedObservation[] = []
  for (let i = 0; i < spec.n; i++) {
    const denied = everyK > 0 && i % everyK === 0
    out.push({
      payerExternalId: spec.payer,
      region: 'OK',
      specialty: 'family_medicine',
      cptHcpcs: spec.cpt,
      modifier: '',
      contractClass: spec.contractClass,
      billedCents: spec.allowed + 5000,
      allowedCents: jitter(spec.allowed),
      paidCents: denied ? 0 : jitter(spec.paid),
      daysToPay: denied ? null : Math.max(5, Math.round(spec.days * (0.8 + r() * 0.4))),
      denied,
      carcCodes: denied ? ['197'] : ['45'],
    })
  }
  return out
}

/** A synthetic, fully de-identified observation set across four payer/code cells. */
export function sampleObservations(): AdjudicatedObservation[] {
  return [
    ...cell({ payer: '00840', cpt: '99214', contractClass: 'commercial', n: 18, allowed: 14000, paid: 11000, days: 21, denialRate: 0.12, seed: 1 }),
    ...cell({ payer: '00840', cpt: '36415', contractClass: 'commercial', n: 14, allowed: 300, paid: 300, days: 18, denialRate: 0.0, seed: 2 }),
    ...cell({ payer: '04312', cpt: '99214', contractClass: 'medicare', n: 16, allowed: 13000, paid: 10400, days: 14, denialRate: 0.06, seed: 3 }),
    // Deliberately small (n < 11) — this cell is suppressed by the gate.
    ...cell({ payer: '73143', cpt: '99215', contractClass: 'commercial', n: 3, allowed: 18000, paid: 0, days: 30, denialRate: 0.9, seed: 4 }),
  ]
}
