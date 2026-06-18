import type { Claim, ClaimLine } from '../canonical'
import type { CciEdit, EditTables, MueTable, ScrubContext, ScrubFinding, ScrubResult, ScrubRule } from './types'
import { OKLAHOMA } from './jurisdiction'

/**
 * The national (NCCI + structural) scrub rules — identical in every state. These
 * run before the jurisdiction layer. DETERMINISTIC, no LLM.
 *
 * The seed edit tables below are illustrative. The real NCCI PTP table is ~2.3M
 * code pairs and the MUE table thousands of caps, both published quarterly by
 * CMS; they load behind the same EditTables seam without any rule-code change.
 */

const SEED_CCI: CciEdit[] = [
  { column1: '80053', column2: '80048', bypassable: false, note: 'Comprehensive metabolic panel includes the basic metabolic panel' },
  { column1: '80053', column2: '82565', bypassable: true, note: 'Creatinine is a component of the CMP' },
  { column1: '93000', column2: '93005', bypassable: false, note: 'Global EKG includes the tracing' },
  { column1: '93000', column2: '93010', bypassable: false, note: 'Global EKG includes the interpretation' },
]

// Illustrative MUE caps (max units per code per day).
const SEED_MUE: MueTable = { '36415': 2, '99213': 1, '99214': 1, '99215': 1, '93000': 1, '80053': 1 }

export const SEED_EDITS: EditTables = { cci: SEED_CCI, mue: SEED_MUE }

// Office/outpatient E/M codes.
const EM_OFFICE = new Set(['99202', '99203', '99204', '99205', '99211', '99212', '99213', '99214', '99215'])
// Modifiers that bypass a bypassable PTP edit (distinct service).
const PTP_BYPASS = new Set(['59', 'XE', 'XS', 'XP', 'XU', '91'])
// Telehealth places of service + their required modifiers.
const TELEHEALTH_POS = new Set(['02', '10'])
const TELEHEALTH_MODS = new Set(['95', 'GT', 'GQ', '93'])

const isEM = (cpt: string): boolean => EM_OFFICE.has(cpt)
// Labs/specimen draws don't trigger the modifier-25 E/M edit (minor services).
const isLabOrDraw = (cpt: string): boolean => cpt === '36415' || /^8\d{4}$/.test(cpt)
const isProcedure = (cpt: string): boolean => Boolean(cpt) && !isEM(cpt) && !isLabOrDraw(cpt)

function requiredFields(claim: Claim): ScrubFinding[] {
  const out: ScrubFinding[] = []
  if (!claim.payer.externalId) out.push({ severity: 'error', source: 'required', code: 'REQ-PAYER', message: 'Missing payer id.' })
  if (!claim.providerNpi && !claim.billingProvider?.npi) out.push({ severity: 'error', source: 'required', code: 'REQ-NPI', message: 'Missing billing/rendering provider NPI.' })
  if (claim.lines.length === 0) out.push({ severity: 'error', source: 'required', code: 'REQ-LINES', message: 'Claim has no service lines.' })
  if (claim.totalBilledCents <= 0) out.push({ severity: 'error', source: 'required', code: 'REQ-CHARGE', message: 'Non-positive total charge.' })
  for (const l of claim.lines) {
    if (!l.cptHcpcs) out.push({ severity: 'error', source: 'required', code: 'REQ-CPT', claimLineId: l.id, message: 'Service line is missing a CPT/HCPCS code.' })
  }
  return out
}

function diagnoses(claim: Claim): ScrubFinding[] {
  const out: ScrubFinding[] = []
  if (claim.diagnoses.length === 0) {
    out.push({ severity: 'error', source: 'diagnosis', code: 'DX-MISSING', message: 'Claim has no diagnosis codes.' })
    return out
  }
  for (const l of claim.lines) {
    for (const p of l.diagnosisPointers) {
      if (p < 1 || p > claim.diagnoses.length) {
        out.push({ severity: 'error', source: 'diagnosis', code: 'DX-POINTER', claimLineId: l.id, cptHcpcs: l.cptHcpcs, message: `Diagnosis pointer ${p} on ${l.cptHcpcs} has no matching diagnosis.` })
      }
    }
  }
  return out
}

function frequencyIcn(claim: Claim): ScrubFinding[] {
  if ((claim.claimFrequencyCode === '7' || claim.claimFrequencyCode === '8') && !claim.originalClaimRef) {
    return [{ severity: 'error', source: 'frequency', code: 'FREQ-ICN', message: `Frequency ${claim.claimFrequencyCode} (replacement/void) requires the original payer claim control number (ICN).`, hint: 'Carry the ICN from the prior 277/835 into originalClaimRef.' }]
  }
  return []
}

function mueCaps(claim: Claim, ctx: ScrubContext): ScrubFinding[] {
  const out: ScrubFinding[] = []
  for (const l of claim.lines) {
    const cap = ctx.edits.mue[l.cptHcpcs]
    if (cap !== undefined && l.units > cap) {
      out.push({ severity: 'error', source: 'mue', code: 'MUE', claimLineId: l.id, cptHcpcs: l.cptHcpcs, message: `${l.units} units of ${l.cptHcpcs} exceeds the MUE of ${cap}.`, hint: 'Reduce units, or split medically-necessary excess with documentation + an appropriate modifier.' })
    }
  }
  return out
}

function cciPairs(claim: Claim, ctx: ScrubContext): ScrubFinding[] {
  const out: ScrubFinding[] = []
  const byCode = new Map<string, ClaimLine>()
  for (const l of claim.lines) byCode.set(l.cptHcpcs, l)
  for (const edit of ctx.edits.cci) {
    const c1 = byCode.get(edit.column1)
    const c2 = byCode.get(edit.column2)
    if (!c1 || !c2) continue
    const hasBypass = c2.modifiers.some((m) => PTP_BYPASS.has(m))
    if (edit.bypassable && hasBypass) continue
    out.push({
      severity: edit.bypassable ? 'warning' : 'error',
      source: 'cci',
      code: 'CCI-PTP',
      claimLineId: c2.id,
      cptHcpcs: edit.column2,
      message: `${edit.column2} is bundled into ${edit.column1} — ${edit.note}.`,
      hint: edit.bypassable
        ? 'If the services were distinct, append modifier 59 (or XE/XS/XP/XU) to the component code; otherwise drop it.'
        : 'These cannot be billed together; remove the component code.',
    })
  }
  return out
}

function modifier25(claim: Claim): ScrubFinding[] {
  const emNoMod = claim.lines.filter((l) => isEM(l.cptHcpcs) && !l.modifiers.includes('25'))
  const hasProcedure = claim.lines.some((l) => isProcedure(l.cptHcpcs))
  if (emNoMod.length === 0 || !hasProcedure) return []
  return emNoMod.map((l) => ({
    severity: 'warning' as const,
    source: 'cci' as const,
    code: 'CCI-25',
    claimLineId: l.id,
    cptHcpcs: l.cptHcpcs,
    message: `E/M ${l.cptHcpcs} is billed the same day as a procedure without modifier 25.`,
    hint: 'Append modifier 25 to the E/M if it was a significant, separately identifiable service — otherwise the payer bundles it into the procedure.',
  }))
}

function telehealthModifier(claim: Claim): ScrubFinding[] {
  if (!claim.placeOfService || !TELEHEALTH_POS.has(claim.placeOfService)) return []
  return claim.lines
    .filter((l) => !l.modifiers.some((m) => TELEHEALTH_MODS.has(m)))
    .map((l) => ({
      severity: 'warning' as const,
      source: 'modifier' as const,
      code: 'TELEHEALTH-MOD',
      claimLineId: l.id,
      cptHcpcs: l.cptHcpcs,
      message: `Telehealth place of service ${claim.placeOfService} but ${l.cptHcpcs} has no telehealth modifier.`,
      hint: 'Append modifier 95 (synchronous telehealth) — payer/jurisdiction policy decides which modifier and POS pair.',
    }))
}

const NATIONAL_RULES: ScrubRule[] = [
  requiredFields,
  diagnoses,
  frequencyIcn,
  mueCaps,
  cciPairs,
  modifier25,
  telehealthModifier,
]

const SEVERITY_ORDER: Record<ScrubFinding['severity'], number> = { error: 0, warning: 1, info: 2 }

/**
 * Scrub a claim: national edits first, then the jurisdiction's state-specific
 * layer. Defaults to Oklahoma + the seed edit tables. `ok` is true when there
 * are no errors (warnings/info still surface).
 */
export function scrubClaim(claim: Claim, jurisdiction = OKLAHOMA, edits: EditTables = SEED_EDITS): ScrubResult {
  const ctx: ScrubContext = { jurisdiction, edits }
  const findings = [...NATIONAL_RULES, ...jurisdiction.rules]
    .flatMap((rule) => rule(claim, ctx))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const errorCount = findings.filter((f) => f.severity === 'error').length
  const warningCount = findings.filter((f) => f.severity === 'warning').length
  return { claimControlNumber: claim.controlNumber, ok: errorCount === 0, findings, errorCount, warningCount }
}
