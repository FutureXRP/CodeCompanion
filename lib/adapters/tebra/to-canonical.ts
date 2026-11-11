import { dollarsToCents } from '../../canonical'
import type {
  Adjustment,
  Claim,
  ClaimTracking,
  ClaimTrackingStatus,
  FeeScheduleLine,
  Payer,
  Remittance,
  RemittanceLine,
} from '../../canonical'
import type { EhrEncounter, EhrServiceLine } from '../ehr'
import { encounterToClaim } from '../ehr'
import type { TebraChargeRaw, TebraPracticeRaw } from './types'

/**
 * Tebra → canonical. One GetCharges record carries all three sides of the Rung 0
 * join for a service line — what was billed, what the contract expects
 * (ExpectedAmount, from Settings > Contracts and Fees), and what the primary
 * payer adjudicated (allowed / paid / adjustments / patient responsibility) — so
 * a pull yields canonical Claims, Remittances AND fee-schedule lines at once.
 * Pure + unit-tested. Money via integer cents. No Tebra type escapes upward.
 *
 * Scope notes:
 *  - The diff is primary-payer: secondary adjudication columns are carried on
 *    the raw record but not folded into the remittance (one Remittance per
 *    claim control number, as with an 835 per payer).
 *  - GetCharges has no payer EDI id or claim ICN: the payer key is a slug of the
 *    billed insurance company name (stable, matches the fee-schedule side), and
 *    payerClaimControlNumber stays empty until GetTransactions / the ERA fills it.
 *  - Encounters billed to the patient only (no insurance company) are skipped —
 *    there is no payer contract to diff against.
 */

export type TebraChargeStatus =
  | 'completed'
  | 'pending'
  | 'ready'
  | 'rejection'
  | 'denial'
  | 'noresponse'
  | 'undefined'
  | 'unknown'

/** MM/DD/YYYY (patient DOB) or YYYY-MM-DD[Thh:mm:ss] (service dates) → YYYY-MM-DD. */
export function tebraDate(d: string | undefined): string {
  if (!d) return ''
  const s = d.trim()
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : ''
}

/** "1,234.50" / "$12" / "(12.00)" / "" → integer cents (blank or unparseable → 0). */
export function tebraCents(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? dollarsToCents(v) : 0
  const s = v.replace(/[$,\s]/g, '')
  if (!s || s === '-') return 0
  const negative = /^\(.*\)$/.test(s)
  const n = Number(negative ? s.slice(1, -1) : s)
  if (!Number.isFinite(n)) return 0
  return dollarsToCents(n) * (negative ? -1 : 1)
}

/** Stable payer key from the billed company name: "Blue Cross Blue Shield of Oklahoma" → BLUECROSSBLUESHIELDOFOKLAHOMA. */
export function payerKey(name: string | undefined): string {
  const slug = (name ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '')
  return slug || 'UNKNOWNPAYER'
}

/** Status text → a stable token ("Error – Denial" / "Error-Denial" / "error denial" all → 'denial'). */
export function normalizeStatus(status: string | undefined): TebraChargeStatus {
  const k = (status ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (k === '' || k === 'undefined') return 'undefined'
  if (k === 'completed') return 'completed'
  if (k === 'pending') return 'pending'
  if (k === 'ready') return 'ready'
  if (k.includes('denial') || k.includes('denied')) return 'denial'
  if (k.includes('rejection') || k.includes('rejected')) return 'rejection'
  if (k.includes('noresponse')) return 'noresponse'
  return 'unknown'
}

const GROUP_CODES = new Set(['CO', 'PR', 'OA', 'PI', 'CR'])

/**
 * Tebra's posted adjustment reason → group + CARC. ERA auto-posting writes codes
 * ("CO-45", "45", "PR 1", "45 - Charge exceeds fee schedule"); a manual posting
 * may be a plain description, which maps to an unrecognized reason the diff
 * routes to manual review.
 */
export function parseAdjustmentReason(reason: string | undefined, defaultGroup = 'CO'): Pick<Adjustment, 'groupCode' | 'carcCode'> {
  const text = (reason ?? '').trim()
  const grouped = /^([A-Za-z]{2})\s*[-–:\s]\s*(\d{1,3})\b/.exec(text)
  if (grouped && GROUP_CODES.has(grouped[1].toUpperCase())) return { groupCode: grouped[1].toUpperCase(), carcCode: grouped[2] }
  const leading = /^(\d{1,3})\b/.exec(text)
  if (leading) return { groupCode: defaultGroup, carcCode: leading[1] }
  const anyGroup = /\b(CO|PR|OA|PI|CR)\b/i.exec(text)
  const anyCode = /\b(\d{1,3})\b/.exec(text)
  return { groupCode: anyGroup ? anyGroup[1].toUpperCase() : defaultGroup, carcCode: anyCode ? anyCode[1] : 'UNKNOWN' }
}

/** "DOE, JANE" (Tebra's display form) or "Jane Doe" → first / last. */
export function splitPatientName(name: string | undefined): { firstName: string; lastName: string } {
  const s = (name ?? '').trim()
  if (!s) return { firstName: '', lastName: '' }
  if (s.includes(',')) {
    const [last, rest = ''] = s.split(',')
    return { lastName: last.trim(), firstName: rest.trim().split(/\s+/)[0] ?? '' }
  }
  const parts = s.split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** Tebra case payer scenario → 837 claim filing indicator. */
export function claimFilingCode(scenario: string | undefined): string | undefined {
  const k = (scenario ?? '').toLowerCase()
  if (!k || k.includes('self')) return undefined
  if (k.includes('medicare')) return 'MB'
  if (k.includes('medicaid') || k.includes('soonercare')) return 'MC'
  if (k.includes('workers')) return 'WC'
  if (k.includes('auto')) return 'AM'
  if (k.includes('tricare') || k.includes('champus')) return 'CH'
  if (k.includes('blue')) return 'BL'
  return 'CI'
}

function payerOf(row: TebraChargeRaw): Payer {
  const name = row.PrimaryInsuranceBilledCompanyName?.trim() || row.PrimaryInsuranceBilledPlanName?.trim() || ''
  return { externalId: payerKey(name), name }
}

function modifiersOf(row: TebraChargeRaw): string[] {
  return [row.ProcedureModifier1, row.ProcedureModifier2, row.ProcedureModifier3, row.ProcedureModifier4]
    .map((m) => (m ?? '').trim().toUpperCase())
    .filter(Boolean)
}

/** ICD-10 codes on the line, dot stripped (E11.65 → E1165) to match the EDI form. */
function diagnosesOf(row: TebraChargeRaw): string[] {
  return [row.DiagnosisCode1, row.DiagnosisCode2, row.DiagnosisCode3, row.DiagnosisCode4]
    .map((d) => (d ?? '').trim().toUpperCase().replace(/\./g, ''))
    .filter(Boolean)
}

function unitsOf(row: TebraChargeRaw): number {
  const n = Number(row.Units)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function billedOf(row: TebraChargeRaw): number {
  return tebraCents(row.TotalCharges) || tebraCents(row.UnitCharge) * unitsOf(row)
}

/** Lines grouped by encounter (insertion order); patient-pay-only and blank rows dropped. */
export function groupByEncounter(rows: TebraChargeRaw[]): Map<string, TebraChargeRaw[]> {
  const groups = new Map<string, TebraChargeRaw[]>()
  for (const row of rows) {
    if (!row.ProcedureCode?.trim()) continue
    if (!payerOf(row).name) continue
    const key = row.EncounterID?.trim() || (row.ID?.trim() ? `claim:${row.ID.trim()}` : '')
    if (!key) continue
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  return groups
}

/** A payer has answered for this line (payment posted — even $0 — or a denial on file). */
export function isAdjudicated(row: TebraChargeRaw): boolean {
  if (row.PrimaryInsurancePaymentID?.trim() || row.PrimaryInsuranceAdjudicationDate?.trim() || row.PrimaryInsurancePaymentPostingDate?.trim()) return true
  const status = normalizeStatus(row.Status)
  if (status === 'denial') return true
  if (status === 'completed') {
    return (
      tebraCents(row.PrimaryInsurancePayment) !== 0 ||
      tebraCents(row.PrimaryInsuranceContractAdjustment) !== 0 ||
      tebraCents(row.PrimaryInsuranceDeductible) + tebraCents(row.PrimaryInsuranceCoinsurance) + tebraCents(row.PrimaryInsuranceCopay) !== 0
    )
  }
  return false
}

export function tebraRowsToEncounter(encounterId: string, rows: TebraChargeRaw[], practice?: TebraPracticeRaw): EhrEncounter {
  const first = rows[0]
  const diagnoses: string[] = []
  const pointerOf = new Map<string, number>()
  for (const row of rows) {
    for (const dx of diagnosesOf(row)) {
      if (!pointerOf.has(dx)) {
        diagnoses.push(dx)
        pointerOf.set(dx, diagnoses.length) // 1-based
      }
    }
  }

  const lines: EhrServiceLine[] = rows.map((row) => ({
    cptHcpcs: row.ProcedureCode!.trim(),
    modifiers: modifiersOf(row),
    units: unitsOf(row),
    chargeCents: billedOf(row),
    diagnosisPointers: diagnosesOf(row).map((dx) => pointerOf.get(dx) ?? 1),
  }))

  const { firstName, lastName } = splitPatientName(first.PatientName)
  const taxId = practice?.TaxID?.replace(/\D/g, '')

  return {
    patientControlNumber: encounterId, // the encounter is the claim; remittances join on it
    payer: payerOf(first),
    subscriber: {
      // GetCharges carries no policy number — the Tebra patient id is the stable
      // per-patient key until GetPatient enriches the policy.
      memberId: first.PatientID?.trim() ?? '',
      firstName,
      lastName,
      dateOfBirth: tebraDate(first.PatientDateOfBirth) || undefined,
      gender: 'U',
    },
    billingProvider: {
      npi: practice?.NPI?.trim() || first.ServiceLocationNPI?.trim() || '',
      organizationName: practice?.PracticeName?.trim() || first.ServiceLocationBillingName?.trim() || first.PracticeName?.trim() || '',
      ...(taxId ? { taxId } : {}),
    },
    dateOfService: tebraDate(first.ServiceStartDate),
    placeOfServiceCode: (first.ServiceLocationPlaceofServiceCode ?? first.ServiceLocationPlaceOfServiceCode)?.trim() || undefined,
    claimFilingCode: claimFilingCode(first.CasePayerScenario),
    diagnoses,
    lines,
  }
}

export function tebraChargesToEncounters(rows: TebraChargeRaw[], practice?: TebraPracticeRaw): EhrEncounter[] {
  return [...groupByEncounter(rows)].map(([encounterId, group]) => tebraRowsToEncounter(encounterId, group, practice))
}

export function tebraChargesToClaims(rows: TebraChargeRaw[], practice?: TebraPracticeRaw): Claim[] {
  return tebraChargesToEncounters(rows, practice).map((e) => encounterToClaim(e, 'tebra'))
}

/** The primary payer's adjudication of one charge as an 835-style remittance line. */
export function tebraRowToRemittanceLine(row: TebraChargeRaw): RemittanceLine {
  const billed = billedOf(row)
  const paid = tebraCents(row.PrimaryInsurancePayment)
  const deductible = tebraCents(row.PrimaryInsuranceDeductible)
  const coinsurance = tebraCents(row.PrimaryInsuranceCoinsurance)
  const copay = tebraCents(row.PrimaryInsuranceCopay)
  const contractAdjustment = tebraCents(row.PrimaryInsuranceContractAdjustment)
  const secondaryAdjustment = tebraCents(row.PrimaryInsuranceSecondaryAdjustment)

  const adjustments: Adjustment[] = []
  if (contractAdjustment !== 0) {
    adjustments.push({ ...parseAdjustmentReason(row.PrimaryInsuranceContractAdjustmentReason), amountCents: contractAdjustment })
  }
  if (secondaryAdjustment !== 0) {
    adjustments.push({ ...parseAdjustmentReason(row.PrimaryInsuranceSecondaryAdjustmentReason), amountCents: secondaryAdjustment })
  }
  if (deductible !== 0) adjustments.push({ groupCode: 'PR', carcCode: '1', amountCents: deductible })
  if (coinsurance !== 0) adjustments.push({ groupCode: 'PR', carcCode: '2', amountCents: coinsurance })
  if (copay !== 0) adjustments.push({ groupCode: 'PR', carcCode: '3', amountCents: copay })
  // A denial posted without adjustment detail must still read as a payer denial, not a $0 payment.
  if (normalizeStatus(row.Status) === 'denial' && paid === 0 && !adjustments.some((a) => a.groupCode !== 'PR')) {
    adjustments.push({ groupCode: 'CO', carcCode: 'DENIED', amountCents: billed })
  }

  const reportedAllowed = tebraCents(row.PrimaryInsuranceAllowed)
  const contractual = adjustments.filter((a) => a.groupCode === 'CO').reduce((sum, a) => sum + a.amountCents, 0)

  return {
    cptHcpcs: row.ProcedureCode!.trim(),
    modifiers: modifiersOf(row),
    units: unitsOf(row),
    billedCents: billed,
    paidCents: paid,
    allowedCents: reportedAllowed > 0 ? reportedAllowed : Math.max(0, billed - contractual),
    patientRespCents: deductible + coinsurance + copay,
    adjustments,
  }
}

/** One Remittance per encounter with at least one adjudicated line (the rest surface as unadjudicated). */
export function tebraChargesToRemittances(rows: TebraChargeRaw[]): Remittance[] {
  const out: Remittance[] = []
  for (const [encounterId, group] of groupByEncounter(rows)) {
    const adjudicated = group.filter(isAdjudicated)
    if (adjudicated.length === 0) continue
    const lines = adjudicated.map(tebraRowToRemittanceLine)
    const allDenied = adjudicated.every((row) => normalizeStatus(row.Status) === 'denial')
    out.push({
      claimControlNumber: encounterId,
      payerClaimControlNumber: '',
      payer: payerOf(group[0]),
      claimStatusCode: allDenied ? '4' : '1',
      totalBilledCents: lines.reduce((sum, l) => sum + l.billedCents, 0),
      totalPaidCents: lines.reduce((sum, l) => sum + l.paidCents, 0),
      patientRespCents: lines.reduce((sum, l) => sum + l.patientRespCents, 0),
      lines,
    })
  }
  return out
}

function trackingStatus(row: TebraChargeRaw): ClaimTrackingStatus {
  const approval = (row.EncounterStatus ?? '').trim().toLowerCase()
  if (approval === 'draft') return 'draft'
  if (approval === 'review') return 'review'
  switch (normalizeStatus(row.Status)) {
    case 'denial':
      return 'denied'
    case 'rejection':
      return 'rejected'
    case 'noresponse':
      return 'no_response'
    default:
      return isAdjudicated(row) ? 'adjudicated' : 'pending'
  }
}

/**
 * Per-line claim tracking — status, balances, and when the primary, the
 * secondary and the patient were billed. The posting workbench works from this
 * (resubmits, status checks, unbilled secondaries, unsent statements).
 */
export function tebraChargesToClaimTracking(rows: TebraChargeRaw[]): ClaimTracking[] {
  const out: ClaimTracking[] = []
  for (const [encounterId, group] of groupByEncounter(rows)) {
    group.forEach((row, i) => {
      const secondaryName = row.SecondaryInsuranceBilledCompanyName?.trim() || row.SecondaryInsuranceBilledPlanName?.trim() || ''
      out.push({
        claimControlNumber: encounterId,
        claimLineId: `${encounterId}:${i + 1}`,
        status: trackingStatus(row),
        lastBilledDate:
          tebraDate(row.PrimaryInsuranceLastBillDate) ||
          tebraDate(row.PrimaryInsuranceFirstBillDate ?? row.PrimaryInsuranceFirstBilDate) ||
          undefined,
        insuranceBalanceCents: tebraCents(row.InsuranceBalance),
        patientBalanceCents: tebraCents(row.PatientBalance),
        ...(secondaryName ? { secondaryPayer: { externalId: payerKey(secondaryName), name: secondaryName } } : {}),
        secondaryBilledDate: tebraDate(row.SecondaryInsuranceFirstBillDate) || undefined,
        patientBilledDate: tebraDate(row.PatientFirstBillDate) || undefined,
      })
    })
  }
  return out
}

/** Contract-expected amounts (Tebra's Contract Rates) as fee-schedule lines, first occurrence per payer/code/modifier. */
export function tebraChargesToFeeScheduleLines(rows: TebraChargeRaw[]): FeeScheduleLine[] {
  const seen = new Set<string>()
  const out: FeeScheduleLine[] = []
  for (const row of rows) {
    const cptHcpcs = row.ProcedureCode?.trim()
    if (!cptHcpcs) continue
    const contractedCents = tebraCents(row.ExpectedAmount) || tebraCents(row.AllowedAmount)
    if (contractedCents <= 0) continue
    const payerExternalId = payerOf(row).externalId
    const modifier = modifiersOf(row)[0]
    const key = `${payerExternalId}|${cptHcpcs}|${modifier ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ payerExternalId, cptHcpcs, modifier, contractedCents })
  }
  return out
}
