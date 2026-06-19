import type { Cents } from '../canonical'

/**
 * The behavioral corpus (Rung 2 foundation) — the moat.
 *
 * SACRED BOUNDARY (CLAUDE.md / COMPLIANCE.md): the corpus stores ONLY
 * de-identified aggregate payer-behavior statistics. It must be structurally
 * impossible for a patient identifier or tenant_id to reach a corpus row. These
 * types enforce that at compile time — neither the observation nor the aggregate
 * row has a field for a patient, tenant, claim, encounter, date, name, or member
 * id. The runtime gate (gate.ts) is the second line of defense.
 *
 * The de-id transform is ONE-WAY: observe() reads PHI-bearing canonical data and
 * emits AdjudicatedObservations stripped of identity; aggregate() buckets those
 * into CorpusRows, suppressing any cell too small to be safely de-identified.
 */

/**
 * One adjudicated service line, already de-identified by construction. Carries
 * payer behavior and money, never a person. No id/claim/date/name field exists.
 */
export interface AdjudicatedObservation {
  /** Payer EDI id — identifies the PAYER, not the patient. Not PHI. */
  payerExternalId: string
  /** Coarse geography only (e.g. 'OK'). Never a street address. */
  region: string
  specialty: string
  cptHcpcs: string
  /** Primary modifier, or '' — a standardized code, not PHI. */
  modifier: string
  /** Bucketed: 'medicare' | 'medicaid' | 'commercial' | 'other'. Never a contract id. */
  contractClass: string
  billedCents: Cents
  allowedCents: Cents
  paidCents: Cents
  /** Duration in days (paid − service date). The interval, never the dates. */
  daysToPay: number | null
  denied: boolean
  /** Standardized CARC codes — HIPAA code set, not PHI. */
  carcCodes: string[]
}

/** A distribution summary — stats, not the raw per-claim values. */
export interface CorpusStat {
  n: number
  mean: number
  p25: number
  p50: number
  p75: number
  min: number
  max: number
}

/**
 * A de-identified aggregate corpus row: how a payer behaves for a code in a
 * region, across many practices. Structurally carries no identifier — there is
 * no field on this type for a patient, tenant, claim, encounter, or date.
 */
export interface CorpusRow {
  payerExternalId: string
  region: string
  specialty: string
  cptHcpcs: string
  modifier: string
  contractClass: string
  allowedStat: CorpusStat
  paidStat: CorpusStat
  daysToPayStat: CorpusStat | null
  /** Fraction of observations denied, 0..1. */
  denialRate: number
  /** Most common CARC codes in the cell — standardized, not PHI. */
  topCarcCodes: string[]
  /** Number of observations behind this row; always ≥ the suppression floor. */
  sampleN: number
}

export interface CorpusResult {
  rows: CorpusRow[]
  /** Cells withheld because the sample was too small to de-identify safely. */
  suppressed: number
  observations: number
}
