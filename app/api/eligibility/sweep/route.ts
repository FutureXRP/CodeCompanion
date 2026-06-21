import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { loadClaims } from '@/lib/adapters/edi'
import {
  MockEligibilityService,
  type EligibilityRequest,
  type EligibilityResult,
  type EligibilityService,
} from '@/lib/rcm/eligibility'
import { StediEligibilityService, stediEligibilityFromEnv } from '@/lib/rcm/stedi-eligibility'
import type { Cents, Claim } from '@/lib/canonical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Workday morning eligibility sweep — runs a real-time 270/271 for every patient
 * on today's synthetic schedule (the same claim set runFoundMoney() diffs, so the
 * names/payers line up with the rest of the day). One row per patient, plus a
 * DETERMINISTIC estimated patient responsibility computed from the parsed 271
 * benefits and the day's billed charges (no LLM touches a dollar figure).
 *
 * Provider selection mirrors /api/eligibility: the local mock by default, Stedi
 * only when a key is present AND in sandbox/test mode. Production (real member PHI
 * to real payers) is refused here — gated by COMPLIANCE.md.
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
  provider: 'mock' | 'stedi'
  sandbox: boolean
  rows: SweepRow[]
  totalEstimatedPatientRespCents: Cents
  checkedAt: string
}

/**
 * Estimate patient out-of-pocket from a 271 summary against today's billed charge.
 * Deterministic and intentionally simple: a fixed copay if the plan carries one,
 * otherwise coinsurance applied to the billed charge, in either case never more
 * than the remaining deductible plus that cost-share, and never more than billed.
 * Inactive coverage means the patient owes the full charge.
 */
export function estimatePatientResponsibility(result: EligibilityResult, billedCents: Cents): Cents {
  if (!result.active) return billedCents

  const deductibleRemaining = result.deductibleRemainingCents ?? 0
  // Charges first erode the remaining deductible (patient pays those in full).
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

function selectProvider(): { service: EligibilityService; provider: 'mock' | 'stedi'; sandbox: boolean } | { error: string; status: number } {
  const stediKey = process.env.STEDI_ELIGIBILITY_API_KEY || process.env.STEDI_API_KEY
  if (!stediKey) {
    return { service: new MockEligibilityService(), provider: 'mock', sandbox: true }
  }
  const sandbox = process.env.STEDI_SANDBOX !== 'false'
  if (!sandbox) {
    return {
      error: 'Eligibility sweep runs in sandbox/test mode only (real member PHI is gated by COMPLIANCE.md). Set STEDI_SANDBOX=true.',
      status: 400,
    }
  }
  return { service: new StediEligibilityService(stediEligibilityFromEnv()), provider: 'stedi', sandbox }
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

  const selection = selectProvider()
  if ('error' in selection) return NextResponse.json({ error: selection.error }, { status: selection.status })
  const { service, provider, sandbox } = selection

  const claims = dayPatients()

  // One eligibility check per scheduled patient. On Stedi sandbox the documented
  // mock only answers for its canned test member, so non-matching members surface
  // as errors on the row rather than failing the whole sweep — the point is that
  // it runs a real 270/271 end to end.
  const dos = new Date().toISOString().slice(0, 10)
  try {
    const rows: SweepRow[] = []
    for (const claim of claims) {
      const sub = claim.subscriber
      const req: EligibilityRequest = {
        payer: claim.payer,
        subscriber: sub
          ? { memberId: sub.memberId, firstName: sub.firstName, lastName: sub.lastName, dateOfBirth: sub.dateOfBirth, gender: sub.gender }
          : { memberId: claim.controlNumber, firstName: 'Patient', lastName: claim.controlNumber },
        provider: { npi: claim.providerNpi ?? '1999999984', organizationName: 'Provider Name' },
        serviceTypeCodes: ['30'],
        dateOfService: dos,
      }
      const result = await service.check(req)
      const estimatedPatientRespCents = estimatePatientResponsibility(result, claim.totalBilledCents)
      rows.push({
        controlNumber: claim.controlNumber,
        patientName: sub ? titleCase(`${sub.firstName} ${sub.lastName}`) : claim.controlNumber,
        payerName: result.payer.name || claim.payer.name,
        memberId: sub?.memberId ?? claim.controlNumber,
        active: result.active,
        status: result.status,
        ...(result.copayCents != null ? { copayCents: result.copayCents } : {}),
        ...(result.coinsurancePercent != null ? { coinsurancePercent: result.coinsurancePercent } : {}),
        ...(result.deductibleRemainingCents != null ? { deductibleRemainingCents: result.deductibleRemainingCents } : {}),
        billedCents: claim.totalBilledCents,
        estimatedPatientRespCents,
        errors: result.errors,
      })
    }

    const body: SweepResponse = {
      provider,
      sandbox,
      rows,
      totalEstimatedPatientRespCents: rows.reduce((sum, r) => sum + r.estimatedPatientRespCents, 0),
      checkedAt: new Date().toISOString(),
    }
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
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
