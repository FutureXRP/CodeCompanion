import type { Payer } from '../canonical'
import { dollarsToCents } from '../canonical'
import type { PayerDirectory } from './payer-directory'
import {
  fetchTransport,
  normalizeBaseUrl,
  stediAuthFromEnv,
  stediHeaders,
  type HttpResponse,
  type HttpTransport,
  type StediAuth,
} from './stedi-http'
import {
  deriveEligibilitySummary,
  type BenefitItem,
  type EligibilityRequest,
  type EligibilityResult,
  type EligibilityService,
  type NetworkScope,
} from './eligibility'

/**
 * Stedi eligibility adapter — real-time X12 270 → 271 over Stedi's JSON
 * eligibility API. JSON in, JSON out (Stedi also returns raw X12); we read the
 * JSON benefits and run them through the shared deterministic derivation, so the
 * money math is identical to the mock and to any future clearinghouse.
 *
 * SAFETY: sandbox vs production is determined by the Stedi API KEY (a test key
 * hits the sandbox), NOT a request field — Stedi's eligibility API rejects an
 * unknown `usageIndicator` (that field belongs to the claims API only). Production
 * (real member PHI to real payers) is gated in createEligibilityService behind
 * ALLOW_REAL_PHI. Request-building and response-mapping are pure + unit-tested.
 *
 * Endpoint path: eligibility/v3; override via `path` (or STEDI_ELIGIBILITY_PATH).
 */

const DEFAULT_PATH = '/2024-04-01/change/medicalnetwork/eligibility/v3'

export interface StediEligibilityConfig extends StediAuth {
  payerDirectory?: PayerDirectory
  /** Override the eligibility endpoint path. */
  path?: string
}

// ── Loose shapes for Stedi's 271 JSON (all optional — parsed defensively) ─────
interface StediEbMessage { description?: string }
interface StediBenefit {
  code?: string
  name?: string
  serviceTypeCodes?: string[]
  serviceTypes?: string[]
  coverageLevelCode?: string
  timeQualifierCode?: string
  benefitAmount?: string | number
  benefitPercent?: string | number
  inPlanNetworkIndicatorCode?: string
  inPlanNetworkIndicator?: string
  additionalInformation?: (StediEbMessage | string)[]
}
interface StediEligError { description?: string; message?: string; code?: string }
interface StediPlanInfo { groupNumber?: string; groupDescription?: string; planNumber?: string }
interface Stedi271 {
  controlNumber?: string
  subscriber?: { memberId?: string; firstName?: string; lastName?: string }
  payer?: { name?: string }
  planInformation?: StediPlanInfo
  benefitsInformation?: StediBenefit[]
  errors?: (StediEligError | string)[]
}

export class StediEligibilityService implements EligibilityService {
  private readonly baseUrl: string
  private readonly path: string
  private readonly transport: HttpTransport

  constructor(private readonly config: StediEligibilityConfig) {
    if (!config.apiKey) throw new Error('StediEligibilityService requires an API key (STEDI_API_KEY).')
    this.baseUrl = normalizeBaseUrl(config.baseUrl)
    this.path = config.path ?? DEFAULT_PATH
    this.transport = config.transport ?? fetchTransport
  }

  async check(request: EligibilityRequest): Promise<EligibilityResult> {
    return (await this.checkRaw(request)).result
  }

  /**
   * Like check(), but also returns the raw HTTP status + body — used by the
   * sandbox-trial surface so the actual Stedi 271 is visible for debugging.
   */
  async checkRaw(request: EligibilityRequest): Promise<{ status: number; body: unknown; result: EligibilityResult }> {
    const payload = canonicalToStedi270(request, {
      tradingPartnerServiceId: this.resolvePayerId(request.payer),
    })
    const res = await this.transport({
      method: 'POST',
      url: this.baseUrl + this.path,
      headers: stediHeaders(this.config.apiKey),
      body: JSON.stringify(payload),
    })
    return { status: res.status, body: res.json, result: mapEligibilityResponse(res, request) }
  }

  /** Resolve the payer's Stedi routing id; fall back to the canonical id if unmapped. */
  private resolvePayerId(payer: Payer): string {
    return this.config.payerDirectory?.resolve(payer.externalId, 'stedi') ?? payer.externalId
  }
}

// ── Pure mappers (exported, unit-tested) ─────────────────────────────────────

/** Build Stedi's 270 JSON request from a canonical eligibility request. */
export function canonicalToStedi270(
  request: EligibilityRequest,
  opts: { tradingPartnerServiceId: string; controlNumber?: string },
): Record<string, unknown> {
  const sub = request.subscriber
  const prov = request.provider
  const ymd = (d?: string) => (d ?? '').replace(/-/g, '')
  // Org provider vs individual provider — emit the shape that matches.
  const provider: Record<string, unknown> = prov.organizationName
    ? { organizationName: prov.organizationName, npi: prov.npi }
    : { firstName: prov.firstName ?? '', lastName: prov.lastName ?? '', npi: prov.npi }
  const serviceTypeCodes = request.serviceTypeCodes && request.serviceTypeCodes.length > 0 ? request.serviceTypeCodes : ['30']

  return {
    controlNumber: opts.controlNumber ?? randomControlNumber(),
    tradingPartnerServiceId: opts.tradingPartnerServiceId,
    provider,
    subscriber: {
      memberId: sub.memberId,
      firstName: sub.firstName,
      lastName: sub.lastName,
      ...(sub.dateOfBirth ? { dateOfBirth: ymd(sub.dateOfBirth) } : {}),
      ...(sub.gender ? { gender: sub.gender } : {}),
    },
    encounter: {
      serviceTypeCodes,
      ...(request.dateOfService ? { dateOfService: ymd(request.dateOfService) } : {}),
    },
  }
}

/** Map Stedi's 271 JSON response into a canonical EligibilityResult. */
export function mapEligibilityResponse(res: HttpResponse, request: EligibilityRequest): EligibilityResult {
  const checkedAt = new Date().toISOString()
  const fallbackMember = {
    memberId: request.subscriber.memberId,
    firstName: request.subscriber.firstName,
    lastName: request.subscriber.lastName,
  }

  if (res.status >= 300 || res.json == null) {
    const errors = extractErrors(res.json)
    return {
      status: 'unknown',
      active: false,
      payer: request.payer,
      member: fallbackMember,
      benefits: [],
      errors: errors.length > 0 ? errors : [`Eligibility check failed (HTTP ${res.status})`],
      checkedAt,
    }
  }

  const body = res.json as Stedi271
  const benefits = (body.benefitsInformation ?? []).map(mapBenefit)
  const summary = deriveEligibilitySummary(benefits)
  const planName = body.planInformation?.groupDescription || body.planInformation?.planNumber || undefined
  const payer: Payer = body.payer?.name ? { externalId: request.payer.externalId, name: body.payer.name } : request.payer

  return {
    ...summary,
    ...(planName ? { planName } : {}),
    active: summary.status === 'active',
    payer,
    member: {
      memberId: String(body.subscriber?.memberId ?? fallbackMember.memberId),
      firstName: String(body.subscriber?.firstName ?? fallbackMember.firstName),
      lastName: String(body.subscriber?.lastName ?? fallbackMember.lastName),
    },
    benefits,
    errors: extractErrors(body),
    checkedAt,
  }
}

function mapBenefit(b: StediBenefit): BenefitItem {
  const amount = b.benefitAmount
  const percent = b.benefitPercent
  return {
    code: String(b.code ?? ''),
    name: String(b.name ?? ''),
    serviceTypeCodes: (b.serviceTypeCodes ?? []).map(String),
    serviceTypes: (b.serviceTypes ?? []).map(String),
    network: mapNetwork(b.inPlanNetworkIndicatorCode ?? b.inPlanNetworkIndicator),
    ...(amount != null && String(amount) !== '' ? { amountCents: dollarsToCents(amount) } : {}),
    ...(percent != null && String(percent) !== '' ? { percent: toFraction(percent) } : {}),
    ...(b.timeQualifierCode ? { timeQualifierCode: String(b.timeQualifierCode) } : {}),
    ...(b.coverageLevelCode ? { coverageLevelCode: String(b.coverageLevelCode) } : {}),
    messages: extractMessages(b),
  }
}

/** EB12 in-plan-network indicator: Y in-network, N out-of-network. */
function mapNetwork(code: string | undefined): NetworkScope {
  const c = (code ?? '').trim().toUpperCase()
  if (c === 'Y') return 'in_network'
  if (c === 'N') return 'out_of_network'
  return 'unknown'
}

/** EB08 benefit percent: X12 carries a decimal fraction (0.2 = 20%); tolerate "20" too. */
function toFraction(p: string | number): number {
  const n = typeof p === 'number' ? p : Number(String(p).trim())
  if (Number.isNaN(n)) return 0
  return n > 1 ? n / 100 : n
}

function extractMessages(b: StediBenefit): string[] {
  return (b.additionalInformation ?? [])
    .map((m) => (typeof m === 'string' ? m : m.description ?? ''))
    .filter((s) => s.length > 0)
}

function extractErrors(body: unknown): string[] {
  if (body == null || typeof body !== 'object') return []
  const errors = (body as Stedi271).errors
  if (!Array.isArray(errors)) return []
  return errors
    .map((e) => (typeof e === 'string' ? e : e.description ?? e.message ?? e.code ?? ''))
    .filter((s) => s.length > 0)
}

/** Stedi requires a control number up to 9 digits; uniqueness per request is enough. */
function randomControlNumber(): string {
  return Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')
}

// ── Env + test fixture ───────────────────────────────────────────────────────

/** Build a Stedi eligibility config from environment. Defaults to sandbox. */
export function stediEligibilityFromEnv(payerDirectory?: PayerDirectory): StediEligibilityConfig {
  return { ...stediAuthFromEnv(), payerDirectory, path: process.env.STEDI_ELIGIBILITY_PATH || undefined }
}

/**
 * Stedi's documented mock-request member (no real PHI): payer STEDI, member
 * 23051322 "Bernie Prohas", provider STEDI / 1447848577. With a TEST API key,
 * Stedi returns mock active coverage for this exact member — test mode is keyed
 * off the key, not a request flag. A real/invalid member returns AAA error 72.
 */
export function buildStediTestEligibility(payerExternalId = 'STEDI'): EligibilityRequest {
  return {
    payer: { externalId: payerExternalId, name: 'Stedi Test Payer' },
    subscriber: { memberId: '23051322', firstName: 'Bernie', lastName: 'Prohas' },
    provider: { npi: '1447848577', organizationName: 'STEDI' },
    serviceTypeCodes: ['30'],
  }
}
