import type { Claim } from '../canonical'

/**
 * Pre-submission scrubber types (Rung 1 → 2 bridge).
 *
 * The scrubber catches what a clearinghouse or payer would REJECT/DENY, before
 * the claim goes out — pure prevention. DETERMINISTIC: rules only, no LLM. It
 * produces findings (errors block, warnings advise), never dollar figures.
 *
 * Rules layer in three tiers, mirroring how billing rules actually stack:
 *   1. NATIONAL   — CPT/ICD/NCCI(CCI+MUE)/modifier rules, identical in every state.
 *   2. JURISDICTION — state-specific: the Medicare MAC (LCDs) + the state Medicaid
 *                     program. This is where "Oklahoma logic" lives.
 *   3. PAYER      — a specific payer's own policies (future; learned empirically
 *                   by the Rung 2 corpus, which is already keyed by region).
 */

export type ScrubSeverity = 'error' | 'warning' | 'info'
export type ScrubSource = 'required' | 'cci' | 'mue' | 'modifier' | 'frequency' | 'diagnosis' | 'jurisdiction'

export interface ScrubFinding {
  severity: ScrubSeverity
  /** Which rule layer raised it. */
  source: ScrubSource
  /** Stable edit code, e.g. 'CCI-PTP', 'MUE', 'CCI-25', 'OK-MAC-JH'. */
  code: string
  message: string
  claimLineId?: string
  cptHcpcs?: string
  /** Deterministic fix hint. */
  hint?: string
}

export interface ScrubResult {
  claimControlNumber: string
  /** No errors (warnings/info are allowed through). */
  ok: boolean
  findings: ScrubFinding[]
  errorCount: number
  warningCount: number
}

/** A national correct-coding (NCCI) procedure-to-procedure edit. */
export interface CciEdit {
  /** The comprehensive (payable) code. */
  column1: string
  /** The component code bundled into column1. */
  column2: string
  /** Modifier indicator 1 → a modifier (59/XE/XS/XP/XU) may bypass; 0 → never. */
  bypassable: boolean
  note: string
}

/** Maximum units of a code per patient per day (NCCI MUE). */
export type MueTable = Record<string, number>

export interface EditTables {
  cci: CciEdit[]
  mue: MueTable
}

/** A scrub rule: pure function from a claim (+ context) to findings. */
export type ScrubRule = (claim: Claim, ctx: ScrubContext) => ScrubFinding[]

/**
 * A billing jurisdiction — a state and the administrators that govern coverage
 * there. The `rules` are the state-specific layer applied on top of the national
 * edits. New states drop in as additional Jurisdiction objects (state-by-state
 * logic = data, not code branches).
 */
export interface Jurisdiction {
  state: string
  label: string
  /** Medicare Administrative Contractor for the state (its LCDs apply). */
  medicareMac?: string
  /** State Medicaid program. */
  medicaidProgram?: string
  rules: ScrubRule[]
}

export interface ScrubContext {
  jurisdiction: Jurisdiction
  edits: EditTables
}
