import type { Cents } from '../canonical'
import type { DenialRecord, Receivable } from './types'

/**
 * A deterministic synthetic A/R book for the analytics demo — a realistic
 * primary-care receivables ledger (hundreds of small claims aged across buckets,
 * weighted by payer mix) plus a period of denials across CARC reasons. Seeded, so
 * it is identical on every run (stable tests + UI). This stands in for the real
 * ledger/diff output until the COMPLIANCE.md gate is closed; the report builders
 * are production code and run unchanged on real data.
 */

export interface ArBook {
  receivables: Receivable[]
  denials: DenialRecord[]
  /** Total claims in the trailing period — denominator for the denial rate. */
  totalClaims: number
  /** Average daily charge volume — denominator for DAR. */
  avgDailyChargeCents: Cents
  asOf: Date
}

interface PayerDef { name: string; id: string; weight: number }
const PAYERS: PayerDef[] = [
  { name: 'Medicare', id: '04312', weight: 0.40 },
  { name: 'Blue Cross Blue Shield', id: '00840', weight: 0.20 },
  { name: 'Aetna', id: '60054', weight: 0.16 },
  { name: 'UnitedHealthcare', id: '87726', weight: 0.12 },
  { name: 'Medicaid (SoonerCare)', id: 'SKOK0', weight: 0.12 },
]

// Denial reasons weighted to a realistic primary-care mix (auth + missing info dominate).
const CARC_WEIGHTS: [string, number][] = [
  ['197', 22], ['16', 18], ['50', 12], ['96', 10], ['97', 10],
  ['18', 8], ['27', 6], ['11', 6], ['29', 4], ['4', 4],
]

const FIRST = ['James', 'Maria', 'Robert', 'Linda', 'David', 'Priya', 'Karen', 'Raymond', 'Susan', 'Eleanor', 'Marcus', 'Devon', 'Harold', 'Nina', 'Omar', 'Grace']
const LAST = ['Okafor', 'Castellano', 'Nair', 'Stoltz', 'Childers', 'Whitfield', 'DeLeon', 'Carter', 'Kim', 'Alvarez', 'Bishop', 'Tran', 'Mercer', 'Holt', 'Frye', 'Sandoval']

/** Deterministic PRNG (mulberry32) — fixed seed → identical book every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickPayer(r: number): PayerDef {
  let acc = 0
  for (const p of PAYERS) {
    acc += p.weight
    if (r <= acc) return p
  }
  return PAYERS[PAYERS.length - 1]
}

function pickCarc(r: number): string {
  const total = CARC_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let acc = 0
  for (const [code, w] of CARC_WEIGHTS) {
    acc += w / total
    if (r <= acc) return code
  }
  return CARC_WEIGHTS[0][0]
}

function isoDaysAgo(asOf: Date, days: number): string {
  return new Date(asOf.getTime() - days * 86_400_000).toISOString().slice(0, 10)
}

export function sampleArBook(asOf: Date = new Date()): ArBook {
  const rng = mulberry32(0x5eed1234)
  const receivables: Receivable[] = []

  // ~420 outstanding claims, ages exponentially skewed toward recent (mean ~30d),
  // patient responsibility growing with age as insurance resolves.
  for (let i = 0; i < 420; i++) {
    const payer = pickPayer(rng())
    const age = Math.min(240, 1 + Math.floor(-30 * Math.log(1 - rng())))
    const amount = 8000 + Math.floor(rng() * 52000) // $80–$600
    const patientProb = age > 90 ? 0.7 : age > 45 ? 0.4 : 0.12
    const isPatient = rng() < patientProb
    receivables.push({
      claimControlNumber: `AR${String(i + 1).padStart(5, '0')}`,
      payerName: payer.name,
      payerExternalId: payer.id,
      patientName: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
      dateOfService: isoDaysAgo(asOf, age),
      insuranceArCents: isPatient ? 0 : amount,
      patientArCents: isPatient ? amount : 0,
    })
  }

  // ~120 denials over the trailing period across the CARC mix.
  const denials: DenialRecord[] = []
  for (let j = 0; j < 120; j++) {
    const payer = pickPayer(rng())
    denials.push({
      claimControlNumber: `DN${String(j + 1).padStart(5, '0')}`,
      payerName: payer.name,
      payerExternalId: payer.id,
      dateOfService: isoDaysAgo(asOf, 5 + Math.floor(rng() * 175)),
      carcCode: pickCarc(rng()),
      deniedCents: 8000 + Math.floor(rng() * 32000), // $80–$400
    })
  }

  return { receivables, denials, totalClaims: 1200, avgDailyChargeCents: 262_500, asOf }
}
