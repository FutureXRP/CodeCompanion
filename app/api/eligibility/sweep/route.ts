import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { loadClaims } from '@/lib/adapters/edi'
import { deriveEligibilitySummary, type BenefitItem, type EligibilityResult } from '@/lib/rcm/eligibility'
import type { Cents, Claim } from '@/lib/canonical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Workday morning eligibility sweep — confirm coverage + estimate patient
 * responsibility for every patient on today's synthetic schedule.
 *
 * These patients are SYNTHETIC, so a real clearinghouse can't identify them — the
 * Stedi sandbox only answers for its own registered test member and returns
 * "Invalid Participant Identification" for anyone else. So the sweep confirms each
 * scheduled patient with the deterministic eligibility engine (the ATHENA_USE_MOCK
 * posture): a representative active-coverage 271 parsed by the SAME
 * deriveEligibilitySummary() used on real 271s. The LIVE Stedi sandbox connection
 * is exercised on the Eligibility page (with Stedi's registered test member).
 * No LLM touches a dollar figure; no real member PHI leaves the app.
 */

export interface SweepRow {
  controlNumber: string
  patientName: string
  payerName: string
  memberId: string
  active: boolean
  status: string
  copayCents?: Cents
  coinsurancePercent?: number
  deductibleRemainingCents?: Cents
  /** Total charges submitted for this patient today (basis for the estimate). */
  billedCents: Cents
  /** Deterministic estimate of what the patient will owe out of pocket. */
  estimatedPatientRespCents: Cents
  errors: string[]
}

export interface SweepResponse {
  provider: 'synthetic'
  sandbox: boolean
  rows: SweepRow[]
  totalEstimatedPatientRespCents: Cents
  checkedAt: string
}

/**
 * Estimate patient out-of-pocket from a 271 summary against today's billed charge.
 * Deterministic and intentionally simple: charges first erode any remaining
 * deductible (patient pays those in full), then a fixed copay if the plan carries
 * one, otherwise coinsurance on the remainder — capped at the billed amount.
 * Inactive coverage means the patient owes the full charge.
 */
export function estimatePatientResponsibility(result: EligibilityResult, billedCents: Cents): Cents {
  if (!result.active) return billedCents

  const deductibleRemaining = result.deductibleRemainingCents ?? 0
  const towardDeductible = Math.min(deductibleRemaining, billedCents)
  const afterDeductible = billedCents - towardDeductible

  let costShare: Cents
  if (result.copayCents != null) {
    costShare = result.copayCents
  } else if (result.coinsurancePercent != null) {
    costShare = Math.round(afterDeductible * result.coinsurancePercent)
  } else {
    costShare = 0
  }

  return Math.min(billedCents, towardDeductible + costShare)
}

/**
 * A deterministic active-coverage 271 for one synthetic scheduled patient —
 * Medicare-style 20% coinsurance with the Part B deductible mostly met mid-year.
 * Built as benefit (EB) segments and run through the real summary derivation, so
 * the parse path is identical to a live 271.
 */
function confirmEligibility(claim: Claim, deductibleRemainingCents: Cents): EligibilityResult {
  const stc = ['30']
  const types = ['Health Benefit Plan Coverage']
  const benefits: BenefitItem[] = [
    { code: '1', name: 'Active Coverage', serviceTypeCodes: stc, serviceTypes: types, network: 'unknown', messages: [] },
    { code: 'A', name: 'Co-Insurance', serviceTypeCodes: stc, serviceTypes: types, network: 'in_network', percent: 0.2, messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: stc, serviceTypes: types, network: 'in_network', coverageLevelCode: 'IND', amountCents: 24000, timeQualifierCode: '23', messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: stc, serviceTypes: types, network: 'in_network', coverageLevelCode: 'IND', amountCents: deductibleRemainingCents, timeQualifierCode: '29', messages: ['Remaining'] },
    { code: 'G', name: 'Out of Pocket (Stop Loss)', serviceTypeCodes: stc, serviceTypes: types, network: 'in_network', amountCents: 300000, timeQualifierCode: '29', messages: ['Remaining'] },
  ]
  const summary = deriveEligibilitySummary(benefits)
  const sub = claim.subscriber
  return {
    ...summary,
    active: summary.status === 'active',
    payer: claim.payer,
    member: { memberId: sub?.memberId ?? claim.controlNumber, firstName: sub?.firstName ?? 'Patient', lastName: sub?.lastName ?? '' },
    benefits,
    errors: [],
    checkedAt: new Date().toISOString(),
  }
}

export async function POST(request: Request): Promise<Response> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  // Body is accepted but unused — the schedule is today's diffed claim set.
  await request.json().catch(() => ({}))

  const claims = dayPatients()
  const rows: SweepRow[] = claims.map((claim, i) => {
    // Most established patients have met the small Part B deductible by mid-year;
    // vary one for realism so the estimate isn't uniform.
    const deductibleRemaining = i === 1 ? 9000 : 0
    const result = confirmEligibility(claim, deductibleRemaining)
    const sub = claim.subscriber
    return {
      controlNumber: claim.controlNumber,
      patientName: sub ? titleCase(`${sub.firstName} ${sub.lastName}`) : claim.controlNumber,
      payerName: claim.payer.name,
      memberId: sub?.memberId ?? claim.controlNumber,
      active: result.active,
      status: result.status,
      ...(result.copayCents != null ? { copayCents: result.copayCents } : {}),
      ...(result.coinsurancePercent != null ? { coinsurancePercent: result.coinsurancePercent } : {}),
      ...(result.deductibleRemainingCents != null ? { deductibleRemainingCents: result.deductibleRemainingCents } : {}),
      billedCents: claim.totalBilledCents,
      estimatedPatientRespCents: estimatePatientResponsibility(result, claim.totalBilledCents),
      errors: result.errors,
    }
  })

  const body: SweepResponse = {
    provider: 'synthetic',
    sandbox: true,
    rows,
    totalEstimatedPatientRespCents: rows.reduce((sum, r) => sum + r.estimatedPatientRespCents, 0),
    checkedAt: new Date().toISOString(),
  }
  return NextResponse.json(body)
}

/**
 * Today's distinct scheduled patients — the same EDI claim files runFoundMoney()
 * diffs, deduped by control number so each patient is checked once.
 */
function dayPatients(): Claim[] {
  const seen = new Set<string>()
  const out: Claim[] = []
  for (const claim of loadClaims()) {
    if (seen.has(claim.controlNumber)) continue
    seen.add(claim.controlNumber)
    out.push(claim)
  }
  return out
}

/** "JOHN DOE" → "John Doe" — the EDI sample carries names upper-cased. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
