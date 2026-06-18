import type { Claim } from '../canonical'
import type { Jurisdiction, ScrubContext, ScrubFinding } from './types'

/**
 * State-by-state logic lives here. A Jurisdiction layers state-specific rules on
 * top of the national edits in engine.ts. The dimension that selects which rules
 * apply is (state + claim filing type): a Medicare claim (MB) in Oklahoma follows
 * the Novitas JH MAC's LCDs; a Medicaid claim (MC) follows SoonerCare/OHCA.
 *
 * SEED, NOT EXHAUSTIVE. These encode the administrators (which are stable facts)
 * plus a few illustrative rules. The full OHCA / Novitas policy + LCD tables are
 * a data-acquisition task (like fee schedules) loaded behind this same seam —
 * verify any specific rule against the current OHCA provider manual and Novitas
 * LCDs before relying on it in production.
 */

const codesOf = (claim: Claim): string => claim.lines.map((l) => l.cptHcpcs).join(', ')

/** Medicare in OK adjudicates under Novitas Solutions (JH) — its LCDs govern coverage. */
function novitasMedicareNote(claim: Claim, ctx: ScrubContext): ScrubFinding[] {
  if (claim.claimFilingCode !== 'MB') return []
  return [
    {
      severity: 'info',
      source: 'jurisdiction',
      code: 'OK-MAC-JH',
      message: `Medicare in Oklahoma adjudicates under ${ctx.jurisdiction.medicareMac}. Coverage and medical necessity follow that MAC's LCDs/NCDs.`,
      hint: `Verify ${codesOf(claim)} against the applicable Novitas JH LCD (required diagnoses, frequency limits) before submitting.`,
    },
  ]
}

/** Medicaid in OK is SoonerCare (OHCA) — its provider manual + PA rules govern. */
function soonerCareMedicaidNote(claim: Claim, ctx: ScrubContext): ScrubFinding[] {
  if (claim.claimFilingCode !== 'MC') return []
  return [
    {
      severity: 'info',
      source: 'jurisdiction',
      code: 'OK-MCD-SOONERCARE',
      message: `Oklahoma Medicaid is ${ctx.jurisdiction.medicaidProgram}. Coverage, prior authorization, and state Medicaid NCCI follow the OHCA provider manual.`,
      hint: `Confirm ${codesOf(claim)} is covered and check whether SoonerCare requires prior authorization for it.`,
    },
  ]
}

/** Oklahoma. Medicare MAC = Novitas JH; Medicaid = SoonerCare (OHCA). */
export const OKLAHOMA: Jurisdiction = {
  state: 'OK',
  label: 'Oklahoma',
  medicareMac: 'Novitas Solutions (Jurisdiction H)',
  medicaidProgram: 'SoonerCare (Oklahoma Health Care Authority)',
  rules: [novitasMedicareNote, soonerCareMedicaidNote],
}

/** A state with no extra layer yet — national edits only. Placeholder for expansion. */
export function genericJurisdiction(state: string): Jurisdiction {
  return { state, label: state, rules: [] }
}

const REGISTRY: Record<string, Jurisdiction> = { OK: OKLAHOMA }

/** Look up the jurisdiction for a state; falls back to national-only. */
export function getJurisdiction(state: string): Jurisdiction {
  return REGISTRY[state.toUpperCase()] ?? genericJurisdiction(state.toUpperCase())
}
