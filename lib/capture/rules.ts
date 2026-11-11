import type { Claim, ClaimLine } from '../canonical'
import { EM_NEXT_LEVEL, UNDERCODING_MIN_DIAGNOSES, UNDERCODING_MIN_LINES } from '../diff'
import type { CaptureFinding, CaptureRule, ReviewContext } from './types'

/**
 * Capture rules — what a good biller checks before approving a primary-care
 * encounter, as code. Every rule is conservative: it flags what the record
 * *may* support and leaves the decision to the provider/biller. Dollars come
 * from the contract rates (RateLookup); no rate → the finding still shows,
 * with no number.
 *
 * Code sets are seeds for primary care; they load behind the same seam as the
 * scrubber's NCCI tables when the full sets are acquired.
 */

const EM_OFFICE = new Set(['99202', '99203', '99204', '99205', '99211', '99212', '99213', '99214', '99215'])
const PREVENTIVE = /^99(38[1-7]|39[1-7])$/
const AWV = new Set(['G0438', 'G0439'])
const VACCINE_ADMIN = new Set(['90460', '90461', '90471', '90472', '90473', '90474', 'G0008', 'G0009', 'G0010'])
/** Modifiers that legitimately repeat a code on the same day. */
const REPEAT_MODS = new Set(['59', '76', '77', '91', 'XE', 'XS', 'XP', 'XU'])
const AWV_ADD_ONS: { code: string; what: string }[] = [
  { code: 'G0444', what: 'Annual depression screening (G0444)' },
  { code: '99497', what: 'Advance care planning, first 30 minutes (99497 — modifier 33 with the AWV, no deductible)' },
]

const isEM = (cpt: string): boolean => EM_OFFICE.has(cpt)
/** CPT 90476–90749: vaccines/toxoids (the product, not the shot). */
const isVaccineProduct = (cpt: string): boolean => /^\d{5}$/.test(cpt) && Number(cpt) >= 90476 && Number(cpt) <= 90749

export function isMedicare(claim: Claim): boolean {
  return claim.claimFilingCode === 'MB' || /MEDICARE/.test(claim.payer.externalId) || /medicare/i.test(claim.payer.name)
}

/** Contracted rate for a line, falling back to its billed charge. */
export function lineRate(claim: Claim, line: ClaimLine, ctx: ReviewContext): number {
  return ctx.rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0]) ?? line.billedCents
}

/** Contracted value of the whole encounter as coded. */
export function claimExpected(claim: Claim, ctx: ReviewContext): number {
  return claim.lines.reduce((sum, l) => sum + lineRate(claim, l, ctx), 0)
}

function finding(claim: Claim, f: Omit<CaptureFinding, 'id' | 'claimControlNumber'>): CaptureFinding {
  return { id: `${f.code}:${f.claimLineId ?? claim.controlNumber}`, claimControlNumber: claim.controlNumber, ...f }
}

/** A vaccine product on the encounter needs its administration code — the shot is paid separately. */
const vaccineAdministration: CaptureRule = (claim, ctx) => {
  const products = claim.lines.filter((l) => isVaccineProduct(l.cptHcpcs))
  const admins = claim.lines.filter((l) => VACCINE_ADMIN.has(l.cptHcpcs))
  const out: CaptureFinding[] = []
  if (products.length > 0 && admins.length === 0) {
    const medicare = isMedicare(claim)
    const adminCode = medicare ? 'G0008' : '90471'
    const rate = ctx.rates.rate(claim.payer.externalId, adminCode) ?? ctx.rates.rate(claim.payer.externalId, '90471') ?? 0
    out.push(
      finding(claim, {
        claimLineId: products[0].id,
        cptHcpcs: products[0].cptHcpcs,
        severity: 'opportunity',
        code: 'CAP-VAX-ADMIN',
        title: 'Vaccine billed without an administration code',
        detail: `${products.map((p) => p.cptHcpcs).join(', ')} is on the encounter but no administration code is (${medicare ? 'G0008 / G0009 / G0010 for Medicare flu, pneumococcal, hepatitis B' : '90471 / 90472, or 90460 / 90461 when the provider counseled'}). The injection is separately payable.`,
        hint: `Add ${adminCode}${products.length > 1 ? ' plus 90472 for each additional vaccine' : ''}.`,
        impact: rate > 0 ? 'opportunity' : 'none',
        impactCents: rate,
      }),
    )
  }
  if (admins.length > 0 && products.length === 0) {
    for (const a of admins) {
      out.push(
        finding(claim, {
          claimLineId: a.id,
          cptHcpcs: a.cptHcpcs,
          severity: 'warning',
          code: 'CAP-VAX-PRODUCT',
          title: 'Vaccine administration without a vaccine product',
          detail: `${a.cptHcpcs} is billed but no vaccine product code (90476–90749) is on the encounter — payers deny the administration without the product.`,
          hint: 'Add the vaccine product code (for VFC stock, the product code with modifier SL).',
          impact: 'at_risk',
          impactCents: lineRate(claim, a, ctx),
        }),
      )
    }
  }
  return out
}

/** The same conservative E/M-level test the diff uses after the fact — applied before the claim goes out. */
const emLevelSupport: CaptureRule = (claim, ctx) => {
  const out: CaptureFinding[] = []
  for (const line of claim.lines) {
    const next = EM_NEXT_LEVEL[line.cptHcpcs]
    if (!next) continue
    const dx = Math.max(line.diagnosisPointers.length, claim.diagnoses.length)
    if (dx < UNDERCODING_MIN_DIAGNOSES || claim.lines.length < UNDERCODING_MIN_LINES) continue
    const current = ctx.rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0])
    const upgraded = ctx.rates.rate(claim.payer.externalId, next)
    const delta = current !== undefined && upgraded !== undefined && upgraded > current ? upgraded - current : 0
    out.push(
      finding(claim, {
        claimLineId: line.id,
        cptHcpcs: line.cptHcpcs,
        severity: 'opportunity',
        code: 'CAP-EM-LEVEL',
        title: `Documentation may support ${next}`,
        detail: `${line.cptHcpcs} with ${dx} diagnoses across ${claim.lines.length} service lines — the medical decision making may meet the next level.`,
        hint: 'The provider confirms the level from the note before approving. Never upcode without the documentation.',
        impact: delta > 0 ? 'opportunity' : 'none',
        impactCents: delta,
      }),
    )
  }
  return out
}

/** Medicare AWV: the screenings commonly done with it are separately payable — only if performed. */
const awvAddOns: CaptureRule = (claim, ctx) => {
  if (!isMedicare(claim) || !claim.lines.some((l) => AWV.has(l.cptHcpcs))) return []
  const codes = new Set(claim.lines.map((l) => l.cptHcpcs))
  return AWV_ADD_ONS.filter((a) => !codes.has(a.code)).map((a) => {
    const rate = ctx.rates.rate(claim.payer.externalId, a.code) ?? 0
    return finding(claim, {
      cptHcpcs: a.code,
      severity: 'opportunity',
      code: 'CAP-AWV-ADDON',
      title: `AWV without ${a.code}`,
      detail: `${a.what} is separately payable with the Annual Wellness Visit when it was performed and documented.`,
      hint: 'Bill it only if it was done — it is not implied by the AWV.',
      impact: rate > 0 ? 'opportunity' : 'none',
      impactCents: rate,
    })
  })
}

/** Medicare G2211: the visit-complexity add-on for a pure office E/M; not payable when the E/M carries modifier 25. */
const visitComplexity: CaptureRule = (claim, ctx) => {
  if (!isMedicare(claim)) return []
  const em = claim.lines.filter((l) => isEM(l.cptHcpcs))
  if (em.length !== 1 || claim.lines.length !== 1 || em[0].modifiers.includes('25')) return []
  if (claim.lines.some((l) => l.cptHcpcs === 'G2211')) return []
  const rate = ctx.rates.rate(claim.payer.externalId, 'G2211') ?? 0
  return [
    finding(claim, {
      claimLineId: em[0].id,
      cptHcpcs: 'G2211',
      severity: 'opportunity',
      code: 'CAP-G2211',
      title: 'Medicare visit-complexity add-on (G2211) not billed',
      detail: 'A Medicare office visit for the ongoing, longitudinal care of a condition can carry G2211. It is not payable when the E/M has modifier 25.',
      hint: 'Add G2211 if this provider is the continuing focal point for the patient’s care.',
      impact: rate > 0 ? 'opportunity' : 'none',
      impactCents: rate,
    }),
  ]
}

/** A problem-oriented E/M billed with a preventive visit needs modifier 25 or it bundles. */
const preventiveWithProblem: CaptureRule = (claim, ctx) => {
  const preventive = claim.lines.filter((l) => PREVENTIVE.test(l.cptHcpcs))
  const problem = claim.lines.filter((l) => isEM(l.cptHcpcs) && !l.modifiers.includes('25'))
  if (preventive.length === 0 || problem.length === 0) return []
  return problem.map((l) =>
    finding(claim, {
      claimLineId: l.id,
      cptHcpcs: l.cptHcpcs,
      severity: 'warning',
      code: 'CAP-PREV-25',
      title: 'Problem visit with a preventive visit needs modifier 25',
      detail: `${l.cptHcpcs} is billed with preventive ${preventive.map((p) => p.cptHcpcs).join(', ')} and no modifier 25 — the payer bundles it into the preventive visit.`,
      hint: 'Append 25 to the problem-oriented E/M; the note must show a separately identifiable problem.',
      impact: 'at_risk',
      impactCents: lineRate(claim, l, ctx),
    }),
  )
}

/** A service line must point at a diagnosis — a clearinghouse rejects the claim otherwise. */
const lineWithoutDiagnosis: CaptureRule = (claim, ctx) =>
  claim.lines
    .filter((l) => l.diagnosisPointers.length === 0)
    .map((l) =>
      finding(claim, {
        claimLineId: l.id,
        cptHcpcs: l.cptHcpcs,
        severity: 'blocker',
        code: 'CAP-LINE-DX',
        title: `${l.cptHcpcs} has no diagnosis`,
        detail: 'A service line must be linked to a diagnosis or the clearinghouse rejects the whole claim.',
        hint: 'Link the line to the diagnosis that justifies it.',
        impact: 'at_risk',
        impactCents: lineRate(claim, l, ctx),
      }),
    )

/** The same code twice without a repeat modifier is a duplicate — one line denies. */
const duplicateLines: CaptureRule = (claim, ctx) => {
  const seen = new Set<string>()
  const out: CaptureFinding[] = []
  for (const l of claim.lines) {
    const key = `${l.cptHcpcs}|${l.modifiers.slice().sort().join(',')}`
    if (seen.has(key) && !l.modifiers.some((m) => REPEAT_MODS.has(m))) {
      out.push(
        finding(claim, {
          claimLineId: l.id,
          cptHcpcs: l.cptHcpcs,
          severity: 'warning',
          code: 'CAP-DUP-LINE',
          title: `${l.cptHcpcs} appears twice`,
          detail: 'The same code is billed twice with the same modifiers — the payer denies the second line as a duplicate.',
          hint: 'Combine into one line with units, or add 76/77/59 if the service was genuinely repeated.',
          impact: 'at_risk',
          impactCents: lineRate(claim, l, ctx),
        }),
      )
    }
    seen.add(key)
  }
  return out
}

/** A line with no charge usually means the fee schedule is missing the code. */
const zeroCharge: CaptureRule = (claim, ctx) =>
  claim.lines
    .filter((l) => l.billedCents <= 0)
    .map((l) =>
      finding(claim, {
        claimLineId: l.id,
        cptHcpcs: l.cptHcpcs,
        severity: 'blocker',
        code: 'CAP-ZERO-CHARGE',
        title: `${l.cptHcpcs} has no charge`,
        detail: 'The line carries a $0.00 charge — the practice fee schedule has no fee for this code, so nothing can be paid on it.',
        hint: 'Add the code to the standard fee schedule, then re-enter the charge.',
        impact: 'at_risk',
        impactCents: ctx.rates.rate(claim.payer.externalId, l.cptHcpcs, l.modifiers[0]) ?? 0,
      }),
    )

export const CAPTURE_RULES: CaptureRule[] = [
  lineWithoutDiagnosis,
  zeroCharge,
  duplicateLines,
  preventiveWithProblem,
  vaccineAdministration,
  emLevelSupport,
  awvAddOns,
  visitComplexity,
]
