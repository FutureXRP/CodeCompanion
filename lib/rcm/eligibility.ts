import type { Cents, Payer, Subscriber } from '../canonical'
import type { ClearinghouseProvider } from './clearinghouse'
import type { PayerDirectory } from './payer-directory'
import {
  StediEligibilityService,
  stediEligibilityFromEnv,
  type StediEligibilityConfig,
} from './stedi-eligibility'

/**
 * Insurance eligibility (X12 270 request / 271 response).
 *
 * Eligibility is the lowest-friction clearinghouse transaction — usually no
 * payer enrollment, real-time, synchronous — and the foundation of revenue-cycle
 * work: confirm coverage is active, surface copay / coinsurance / deductible
 * before the visit, and (later) discover unknown coverage. Like every financial
 * figure on the platform, the benefit numbers here are produced by DETERMINISTIC
 * code (parsing the 271), never by an LLM.
 *
 * This file is the canonical-facing seam: the service INTERFACE, a MOCK for
 * synthetic-data demos (the ATHENA_USE_MOCK posture), the deterministic 271→
 * summary derivation, and the provider-agnostic factory. Vendor (Stedi) JSON
 * shapes live in stedi-eligibility.ts and never leak above this seam.
 */

export type CoverageStatus = 'active' | 'inactive' | 'unknown'
export type NetworkScope = 'in_network' | 'out_of_network' | 'unknown'

/**
 * One parsed 271 benefit (EB) segment, normalized. Faithful 1:1 with the 271 so
 * the full benefit detail is preserved; the convenience summary is derived from
 * the collection (see deriveEligibilitySummary).
 */
export interface BenefitItem {
  /** EB01 eligibility/benefit info code, e.g. "1" active, "B" copay, "A" coinsurance, "C" deductible, "G" out-of-pocket. */
  code: string
  /** Human-readable benefit name, e.g. "Active Coverage", "Co-Payment". */
  name: string
  /** X12 service type codes this benefit applies to, e.g. ["30"] general, ["98"] office visit. */
  serviceTypeCodes: string[]
  /** Human-readable service types. */
  serviceTypes: string[]
  network: NetworkScope
  /** Monetary amount in integer cents, when the benefit carries one (deductible, OOP, copay). */
  amountCents?: Cents
  /** Coinsurance as a fraction 0..1 (e.g. 0.2 = 20%), when present. */
  percent?: number
  /** Time qualifier, e.g. "29" remaining, "23" calendar year, "22" service year. */
  timeQualifierCode?: string
  /** Coverage level, e.g. "IND" individual, "FAM" family. */
  coverageLevelCode?: string
  /** Free-text messages (EB additional information). */
  messages: string[]
}

/** Convenience financials derived from a 271's benefits. Best-effort, deterministic. */
export interface EligibilitySummary {
  status: CoverageStatus
  planName?: string
  copayCents?: Cents
  coinsurancePercent?: number
  deductibleCents?: Cents
  deductibleRemainingCents?: Cents
  outOfPocketCents?: Cents
  outOfPocketRemainingCents?: Cents
}

export interface EligibilityProvider {
  npi: string
  organizationName?: string
  firstName?: string
  lastName?: string
}

export interface EligibilityRequest {
  /** Canonical payer; externalId is resolved to the clearinghouse routing id at the edge. */
  payer: Payer
  /** The insured. PHI — never reaches the de-identified corpus. */
  subscriber: Pick<Subscriber, 'memberId' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender'>
  provider: EligibilityProvider
  /** X12 service type codes to check; defaults to ["30"] (health benefit plan coverage). */
  serviceTypeCodes?: string[]
  /** YYYY-MM-DD (or YYYYMMDD) date of service; optional. */
  dateOfService?: string
}

export interface EligibilityResult extends EligibilitySummary {
  /** True when coverage is active — the common gate. (status === 'active'.) */
  active: boolean
  payer: Payer
  member: { memberId: string; firstName: string; lastName: string }
  /** Every parsed benefit, for full detail beyond the summary. */
  benefits: BenefitItem[]
  /** Clearinghouse/payer errors (e.g. member not found, payer unavailable). */
  errors: string[]
  /** ISO timestamp the check was performed. */
  checkedAt: string
  /** Stedi application mode from the 271 meta ('test' | 'production') — which payer was actually hit. */
  mode?: string
}

export interface EligibilityService {
  /** Run a real-time eligibility check (270) and return the parsed benefits (271). */
  check(request: EligibilityRequest): Promise<EligibilityResult>
}

// ── Deterministic 271 → summary derivation (no LLM, auditable) ────────────────

const ACTIVE_CODES = new Set(['1', '2', '3']) // active coverage variants
const INACTIVE_CODES = new Set(['6', '7', '8']) // inactive variants
const REMAINING_TIME_QUALIFIER = '29' // EB06 "remaining"

/**
 * Collapse a benefit collection into the headline summary a front desk needs.
 * Rules are explicit and deterministic: active beats inactive; financials prefer
 * in-network; "remaining" amounts are the EB06="29" entries.
 */
export function deriveEligibilitySummary(benefits: BenefitItem[]): EligibilitySummary {
  const status: CoverageStatus = benefits.some((b) => ACTIVE_CODES.has(b.code))
    ? 'active'
    : benefits.some((b) => INACTIVE_CODES.has(b.code))
      ? 'inactive'
      : 'unknown'

  const copay = pickBenefit(benefits, 'B')
  const coinsurance = pickBenefit(benefits, 'A')
  const deductible = pickBenefit(benefits, 'C', { remaining: false })
  const deductibleRemaining = pickBenefit(benefits, 'C', { remaining: true })
  const outOfPocket = pickBenefit(benefits, 'G', { remaining: false })
  const outOfPocketRemaining = pickBenefit(benefits, 'G', { remaining: true })

  return {
    status,
    ...(copay?.amountCents != null ? { copayCents: copay.amountCents } : {}),
    ...(coinsurance?.percent != null ? { coinsurancePercent: coinsurance.percent } : {}),
    ...(deductible?.amountCents != null ? { deductibleCents: deductible.amountCents } : {}),
    ...(deductibleRemaining?.amountCents != null ? { deductibleRemainingCents: deductibleRemaining.amountCents } : {}),
    ...(outOfPocket?.amountCents != null ? { outOfPocketCents: outOfPocket.amountCents } : {}),
    ...(outOfPocketRemaining?.amountCents != null ? { outOfPocketRemainingCents: outOfPocketRemaining.amountCents } : {}),
  }
}

/** First benefit matching `code`, preferring in-network; optional "remaining" filter on EB06. */
function pickBenefit(benefits: BenefitItem[], code: string, opts?: { remaining?: boolean }): BenefitItem | undefined {
  const matches = benefits.filter((b) => b.code === code)
  const filtered =
    opts?.remaining === undefined
      ? matches
      : matches.filter((b) => (b.timeQualifierCode === REMAINING_TIME_QUALIFIER) === opts.remaining)
  return filtered.find((b) => b.network === 'in_network') ?? filtered[0]
}

// ── Mock service (synthetic data — the ATHENA_USE_MOCK posture) ───────────────

/**
 * Deterministic synthetic eligibility — no network, no account, no PHI. A member
 * id containing "inactive" (or "term") returns terminated coverage; everything
 * else returns active coverage with a representative benefit set, so the parsing
 * and UI can be exercised end to end locally.
 */
export class MockEligibilityService implements EligibilityService {
  async check(request: EligibilityRequest): Promise<EligibilityResult> {
    const checkedAt = new Date().toISOString()
    const member = {
      memberId: request.subscriber.memberId,
      firstName: request.subscriber.firstName,
      lastName: request.subscriber.lastName,
    }
    const inactive = /inactive|term/i.test(request.subscriber.memberId)
    const benefits = inactive ? mockInactiveBenefits() : mockActiveBenefits()
    const summary = deriveEligibilitySummary(benefits)
    return { ...summary, active: summary.status === 'active', payer: request.payer, member, benefits, errors: [], checkedAt }
  }
}

function mockInactiveBenefits(): BenefitItem[] {
  return [
    {
      code: '6',
      name: 'Inactive',
      serviceTypeCodes: ['30'],
      serviceTypes: ['Health Benefit Plan Coverage'],
      network: 'unknown',
      messages: ['Coverage terminated (mock).'],
    },
  ]
}

function mockActiveBenefits(): BenefitItem[] {
  const general = ['30']
  const office = ['98']
  return [
    { code: '1', name: 'Active Coverage', serviceTypeCodes: general, serviceTypes: ['Health Benefit Plan Coverage'], network: 'unknown', messages: [] },
    { code: 'B', name: 'Co-Payment', serviceTypeCodes: office, serviceTypes: ['Professional (Physician) Visit - Office'], network: 'in_network', amountCents: 2500, messages: [] },
    { code: 'A', name: 'Co-Insurance', serviceTypeCodes: general, serviceTypes: ['Health Benefit Plan Coverage'], network: 'in_network', percent: 0.2, messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: general, serviceTypes: ['Health Benefit Plan Coverage'], network: 'in_network', coverageLevelCode: 'IND', amountCents: 150000, timeQualifierCode: '23', messages: [] },
    { code: 'C', name: 'Deductible', serviceTypeCodes: general, serviceTypes: ['Health Benefit Plan Coverage'], network: 'in_network', coverageLevelCode: 'IND', amountCents: 50000, timeQualifierCode: '29', messages: ['Remaining'] },
    { code: 'G', name: 'Out of Pocket (Stop Loss)', serviceTypeCodes: general, serviceTypes: ['Health Benefit Plan Coverage'], network: 'in_network', amountCents: 500000, timeQualifierCode: '23', messages: [] },
    { code: 'G', name: 'Out of Pocket (Stop Loss)', serviceTypeCodes: general, serviceTypes: ['Health Benefit Plan Coverage'], network: 'in_network', amountCents: 300000, timeQualifierCode: '29', messages: ['Remaining'] },
  ]
}

// ── Provider-agnostic factory (production gated by COMPLIANCE.md) ─────────────

export interface EligibilityConfig {
  provider: ClearinghouseProvider
  payerDirectory?: PayerDirectory
  /** Real providers send member PHI to payers — refuse unless the COMPLIANCE.md gate is open. */
  allowRealPhi?: boolean
  /** Stedi adapter options (api key, sandbox flag). Falls back to STEDI_* env. */
  stedi?: StediEligibilityConfig
}

/**
 * Same seam as the clearinghouse factory: today `mock` and `stedi` are wired; any
 * other clearinghouse drops in behind the EligibilityService interface. Eligibility
 * generally needs no payer enrollment, but a real check still transmits member PHI,
 * so production is gated behind ALLOW_REAL_PHI.
 */
export function createEligibilityService(config: EligibilityConfig): EligibilityService {
  switch (config.provider) {
    case 'mock':
      return new MockEligibilityService()
    case 'stedi': {
      const stedi = config.stedi ?? stediEligibilityFromEnv(config.payerDirectory)
      const production = stedi.sandbox === false
      if (production && !config.allowRealPhi) {
        throw new Error(
          'Stedi eligibility in production sends real member PHI to payers — gated by COMPLIANCE.md. ' +
            'Set allowRealPhi=true (ALLOW_REAL_PHI) only after a BAA is in place. ' +
            'Use sandbox mode (STEDI_SANDBOX=true) for synthetic testing.',
        )
      }
      return new StediEligibilityService({ ...stedi, payerDirectory: stedi.payerDirectory ?? config.payerDirectory })
    }
    case 'claimmd':
    case 'availity':
    case 'office_ally':
      if (!config.allowRealPhi) {
        throw new Error(
          `Eligibility adapter '${config.provider}' transmits member PHI to payers and is gated by COMPLIANCE.md. ` +
            'Set allowRealPhi=true (ALLOW_REAL_PHI) only after a BAA is in place.',
        )
      }
      throw new Error(
        `Eligibility adapter '${config.provider}' is not implemented yet — wire it behind the EligibilityService interface.`,
      )
    default: {
      const exhaustive: never = config.provider
      throw new Error(`Unknown eligibility provider: ${String(exhaustive)}`)
    }
  }
}
