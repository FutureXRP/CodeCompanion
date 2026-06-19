import type { AdjudicatedObservation, CorpusRow } from './types'

/**
 * The de-identification gate — the runtime backstop to the type system.
 *
 * Every corpus row passes through assertDeidentified() before it can be used or
 * persisted. If anything identifier-shaped is present, it THROWS — a breach-class
 * bug must fail loudly, never be written. This is defense in depth: the types
 * already make identifier fields impossible; this catches casts, future fields,
 * and value-level leakage (a member id smuggled into a string dimension).
 */

/** CMS-style small-cell suppression: never publish a cell below this many samples. */
export const MIN_SAMPLE_N = 11

// A key containing any of these (case-insensitive) is a forbidden identifier dimension.
const FORBIDDEN_KEY_SUBSTRINGS = [
  'tenant', 'patient', 'claim', 'encounter', 'member', 'subscriber', 'insured',
  'mrn', 'ssn', 'npi', 'dob', 'birth', 'name', 'address', 'street', 'zip', 'postal',
  'dateofservice', 'dos', 'email', 'phone', 'account',
]

// A run of 9+ digits looks like an SSN / member id / account number (CPT is 5, payer ids ≤ ~6).
const IDENTIFIER_DIGITS = /\d{9,}/

function scanKeys(obj: object, label: string): void {
  for (const key of Object.keys(obj)) {
    const k = key.toLowerCase()
    if (FORBIDDEN_KEY_SUBSTRINGS.some((s) => k.includes(s))) {
      throw new Error(`De-id gate: forbidden identifier key "${key}" on ${label}`)
    }
  }
}

function scanValue(v: string, label: string): void {
  if (IDENTIFIER_DIGITS.test(v)) {
    throw new Error(`De-id gate: value "${v}" on ${label} looks like an identifier`)
  }
}

/** Assert a corpus row carries no identifier and respects the suppression floor. */
export function assertDeidentified(row: CorpusRow): void {
  scanKeys(row, 'corpus row')
  if (!Number.isInteger(row.sampleN) || row.sampleN < MIN_SAMPLE_N) {
    throw new Error(`De-id gate: sample_n ${row.sampleN} is below the suppression floor ${MIN_SAMPLE_N}`)
  }
  // Region must be coarse geography — no digits (zip/address) and short.
  if (/\d/.test(row.region) || row.region.length > 24) {
    throw new Error(`De-id gate: region "${row.region}" is not coarse geography`)
  }
  for (const v of [row.payerExternalId, row.region, row.specialty, row.cptHcpcs, row.modifier, row.contractClass, ...row.topCarcCodes]) {
    scanValue(v, 'corpus row dimension')
  }
  if (!Number.isFinite(row.denialRate) || row.denialRate < 0 || row.denialRate > 1) {
    throw new Error(`De-id gate: denialRate ${row.denialRate} is out of range`)
  }
}

/** Lighter gate for the observation stage: no identifier key, coarse region. */
export function assertObservationClean(o: AdjudicatedObservation): void {
  scanKeys(o, 'observation')
  if (/\d/.test(o.region) || o.region.length > 24) {
    throw new Error(`De-id gate: observation region "${o.region}" is not coarse geography`)
  }
  for (const v of [o.payerExternalId, o.region, o.specialty, o.cptHcpcs, o.modifier, o.contractClass, ...o.carcCodes]) {
    scanValue(v, 'observation dimension')
  }
}
