import { parse835, parse837 } from '../adapters/edi'
import type { Address, Claim, Remittance } from '../canonical'
import type { Clearinghouse, SubmissionAck, ClaimStatusResponse, ClaimStatusCategory } from './clearinghouse'
import type { PayerDirectory } from './payer-directory'

/**
 * Stedi sandbox clearinghouse adapter.
 *
 * Stedi is an API-first clearinghouse: JSON/HTTP in, X12 out to the payer. It
 * exposes a *raw X12* professional-claims endpoint, so we transmit the exact
 * 837 our deterministic generator produces (no lossy JSON remap) and parse the
 * returned 835 ERAs with the existing parse835 — no new money math.
 *
 * SAFETY: defaults to SANDBOX (usageIndicator "T"). Production (real PHI to real
 * payers) requires sandbox:false AND, at the factory, ALLOW_REAL_PHI — never
 * defaults on. Endpoint paths follow Stedi's healthcare API; confirm against
 * docs.stedi.com before live use and override via `paths` if they differ.
 *
 * The HTTP transport is injectable, so request-building and response-mapping are
 * unit-tested without a network or an account.
 */

const DEFAULT_BASE_URL = 'https://healthcare.us.stedi.com'
const DEFAULT_PATHS = {
  submitJson: '/2024-04-01/change/medicalnetwork/professionalclaims/v3/submission',
  submitRawX12: '/2024-04-01/change/medicalnetwork/professionalclaims/v3/raw-x12-submission',
  claimStatus: '/2024-04-01/change/medicalnetwork/claimstatus/v2',
  listEras: '/2024-04-01/change/medicalnetwork/reports/v2',
}
type Paths = typeof DEFAULT_PATHS

export interface HttpResponse {
  status: number
  json: unknown
}
export interface HttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}
export type HttpTransport = (req: HttpRequest) => Promise<HttpResponse>

export interface StediConfig {
  apiKey: string
  /** Sandbox uses test data + usageIndicator "T"; production uses "P". Default sandbox. */
  sandbox?: boolean
  baseUrl?: string
  payerDirectory?: PayerDirectory
  paths?: Partial<Paths>
  /** Injectable for tests; defaults to a global-fetch transport. */
  transport?: HttpTransport
}

// ── Loose shapes for Stedi's JSON (all fields optional — parsed defensively) ──
interface StediError { message?: string; description?: string; code?: string }
interface StediClaimRef {
  patientControlNumber?: string
  claimControlNumber?: string
  correlationId?: string
  status?: string
  stediId?: string
  traceId?: string
  claimReference?: string
  errors?: StediError[]
}
interface StediSubmissionBody {
  transactionId?: string
  stediId?: string
  traceId?: string
  claimReferences?: StediClaimRef[]
  claims?: StediClaimRef[]
  errors?: StediError[]
}
interface StediStatusBody {
  claimStatusCategoryCode?: string
  statusCategoryCode?: string
  category?: string
  statusDescription?: string
  description?: string
  errors?: StediError[]
}
interface StediEraItem { rawX12?: string; x12?: string }
interface StediEraBody { items?: (string | StediEraItem)[]; eras?: (string | StediEraItem)[] }

const fetchTransport: HttpTransport = async (req) => {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try { json = JSON.parse(text) } catch { json = { raw: text } }
  }
  return { status: res.status, json }
}

export class StediClearinghouse implements Clearinghouse {
  private readonly baseUrl: string
  private readonly paths: Paths
  private readonly transport: HttpTransport

  constructor(private readonly config: StediConfig) {
    if (!config.apiKey) throw new Error('StediClearinghouse requires an API key (STEDI_API_KEY).')
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.paths = { ...DEFAULT_PATHS, ...config.paths }
    this.transport = config.transport ?? fetchTransport
  }

  private headers(): Record<string, string> {
    // Stedi expects the raw API key in Authorization (no "Bearer"/"Key" prefix).
    return { Authorization: this.config.apiKey, 'Content-Type': 'application/json' }
  }

  /** Sandbox by default — only "P" when production is explicitly requested. */
  private usageIndicator(): 'T' | 'P' {
    return this.config.sandbox === false ? 'P' : 'T'
  }

  async submit(edi837: string): Promise<SubmissionAck[]> {
    return (await this.submitRaw(edi837)).acks
  }

  /**
   * Like submit(), but also returns the raw HTTP status + body. Used by the
   * sandbox-trial surface so the actual Stedi response is visible for debugging
   * (e.g. confirming endpoint paths against a real account).
   */
  async submitRaw(edi837: string): Promise<{ status: number; body: unknown; acks: SubmissionAck[] }> {
    const submitted = parse837(edi837).map((c) => c.controlNumber)
    const res = await this.transport({
      method: 'POST',
      url: this.baseUrl + this.paths.submitRawX12,
      headers: { ...this.headers(), 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ rawX12: edi837, usageIndicator: this.usageIndicator() }),
    })
    return { status: res.status, body: res.json, acks: mapSubmissionResponse(res, submitted) }
  }

  /** Submit a structured JSON professional claim — the test-mode-supported path. */
  async submitJson(payload: unknown): Promise<{ status: number; body: unknown }> {
    const res = await this.transport({
      method: 'POST',
      url: this.baseUrl + this.paths.submitJson,
      headers: { ...this.headers(), 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(payload),
    })
    return { status: res.status, body: res.json }
  }

  async checkStatus(claimControlNumbers: string[]): Promise<ClaimStatusResponse[]> {
    const out: ClaimStatusResponse[] = []
    for (const cn of claimControlNumbers) {
      const res = await this.transport({
        method: 'POST',
        url: this.baseUrl + this.paths.claimStatus,
        headers: this.headers(),
        body: JSON.stringify({ usageIndicator: this.usageIndicator(), claimControlNumber: cn }),
      })
      out.push(mapClaimStatusResponse(res, cn))
    }
    return out
  }

  async fetchRemittances(): Promise<Remittance[]> {
    const res = await this.transport({
      method: 'GET',
      url: this.baseUrl + this.paths.listEras,
      headers: this.headers(),
    })
    return extractRawX12Eras(res).flatMap((x12) => parse835(x12))
  }
}

// ── Response mappers (exported, pure, unit-tested) ───────────────────────────

export function mapSubmissionResponse(res: HttpResponse, submittedControlNumbers: string[]): SubmissionAck[] {
  const body = (res.json ?? {}) as StediSubmissionBody
  const refs = body.claimReferences ?? body.claims ?? null

  if (refs && refs.length > 0) {
    return refs.map((r) => {
      const cn = String(r.patientControlNumber ?? r.claimControlNumber ?? r.correlationId ?? '')
      const rejected = res.status >= 300 || (r.errors?.length ?? 0) > 0 || (r.status ?? '').toLowerCase() === 'rejected'
      if (rejected) {
        return { claimControlNumber: cn, status: 'rejected', rejectReason: errText(r.errors) ?? 'Rejected by clearinghouse' }
      }
      const payerRef = String(r.stediId ?? r.traceId ?? r.claimReference ?? body.transactionId ?? '')
      return { claimControlNumber: cn, status: 'accepted', payerClaimControlNumber: payerRef || undefined }
    })
  }

  // No per-claim breakdown: a 2xx with no errors means the batch was accepted.
  if (res.status < 300 && (body.errors?.length ?? 0) === 0) {
    const trace = String(body.transactionId ?? body.stediId ?? body.traceId ?? '') || undefined
    return submittedControlNumbers.map((cn) => ({ claimControlNumber: cn, status: 'accepted', payerClaimControlNumber: trace }))
  }

  const reason = errText(body.errors) ?? `Clearinghouse rejected submission (HTTP ${res.status})`
  return submittedControlNumbers.map((cn) => ({ claimControlNumber: cn, status: 'rejected', rejectReason: reason }))
}

export function mapClaimStatusResponse(res: HttpResponse, claimControlNumber: string): ClaimStatusResponse {
  const body = (res.json ?? {}) as StediStatusBody
  if (res.status >= 300) {
    return { claimControlNumber, category: 'unknown', description: errText(body.errors) ?? `Status check failed (HTTP ${res.status})` }
  }
  const raw = String(body.claimStatusCategoryCode ?? body.statusCategoryCode ?? body.category ?? '')
  return {
    claimControlNumber,
    category: mapStatusCategory(raw),
    description: String(body.statusDescription ?? body.description ?? raw ?? 'No status'),
  }
}

/**
 * X12 277 claim-status category codes (simplified): A-codes acknowledged/accepted,
 * F-codes finalized, P-codes pending, R-codes and D-codes rejected/denied.
 */
export function mapStatusCategory(code: string): ClaimStatusCategory {
  const c = code.trim().toUpperCase()
  if (!c) return 'unknown'
  if (c.startsWith('F')) return 'finalized'
  if (c.startsWith('A')) return 'accepted'
  if (c.startsWith('P')) return 'pending'
  if (c.startsWith('R') || c.startsWith('D')) return 'rejected'
  return 'unknown'
}

function extractRawX12Eras(res: HttpResponse): string[] {
  if (res.status >= 300 || res.json == null) return []
  const body = res.json as StediEraBody | (string | StediEraItem)[]
  const items = Array.isArray(body) ? body : body.items ?? body.eras ?? []
  return items
    .map((it) => (typeof it === 'string' ? it : it.rawX12 ?? it.x12 ?? ''))
    .filter((s) => s.includes('ST*835'))
}

function errText(errors: StediError[] | undefined): string | undefined {
  if (!errors || errors.length === 0) return undefined
  return errors.map((e) => e.message ?? e.description ?? e.code ?? JSON.stringify(e)).join('; ')
}

/** Build a Stedi config from environment. Defaults to sandbox; production is opt-in. */
export function stediFromEnv(payerDirectory?: PayerDirectory): StediConfig {
  const apiKey = process.env.STEDI_API_KEY
  if (!apiKey) throw new Error('STEDI_API_KEY is not set — cannot build the Stedi clearinghouse adapter.')
  return {
    apiKey,
    sandbox: process.env.STEDI_SANDBOX !== 'false', // must explicitly opt into production
    baseUrl: process.env.STEDI_BASE_URL || undefined,
    payerDirectory,
  }
}

function stediAddress(a: Address): Record<string, unknown> {
  return {
    address1: a.line1,
    ...(a.line2 ? { address2: a.line2 } : {}),
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
  }
}

/**
 * Map an enriched canonical Claim into Stedi's JSON professional-claim shape.
 * Requires subscriber + billing provider — a payable claim cannot be built
 * without them. This is the bridge from the canonical model (fed by the EHR
 * adapter) to the clearinghouse.
 */
export function canonicalToStediClaim(
  claim: Claim,
  opts: { tradingPartnerServiceId: string; usageIndicator?: 'T' | 'P'; submitterId?: string },
): Record<string, unknown> {
  const sub = claim.subscriber
  const bp = claim.billingProvider
  if (!sub) throw new Error('canonicalToStediClaim: claim.subscriber is required')
  if (!bp) throw new Error('canonicalToStediClaim: claim.billingProvider is required')
  const rp = claim.renderingProvider
  const money = (cents: number) => (cents / 100).toFixed(2)
  const ymd = (d?: string) => (d ?? '').replace(/-/g, '')
  const contact = { name: bp.organizationName, phoneNumber: bp.phone ?? '0000000000' }
  const submitterId = opts.submitterId ?? bp.taxId

  return {
    usageIndicator: opts.usageIndicator ?? 'T',
    tradingPartnerServiceId: opts.tradingPartnerServiceId,
    tradingPartnerName: claim.payer.name,
    submitter: {
      organizationName: bp.organizationName,
      ...(submitterId ? { submitterIdentification: submitterId } : {}),
      contactInformation: contact,
    },
    receiver: { organizationName: claim.payer.name },
    subscriber: {
      memberId: sub.memberId,
      paymentResponsibilityLevelCode: 'P',
      firstName: sub.firstName,
      lastName: sub.lastName,
      gender: sub.gender ?? 'U',
      dateOfBirth: ymd(sub.dateOfBirth),
      ...(sub.address ? { address: stediAddress(sub.address) } : {}),
    },
    billing: {
      providerType: 'BillingProvider',
      npi: bp.npi,
      ...(bp.taxId ? { employerId: bp.taxId } : {}),
      ...(bp.taxonomyCode ? { taxonomyCode: bp.taxonomyCode } : {}),
      organizationName: bp.organizationName,
      ...(bp.address ? { address: stediAddress(bp.address) } : {}),
      contactInformation: contact,
    },
    claimInformation: {
      claimFilingCode: claim.claimFilingCode ?? 'MB',
      patientControlNumber: claim.controlNumber,
      claimChargeAmount: money(claim.totalBilledCents),
      placeOfServiceCode: claim.placeOfService ?? '11',
      claimFrequencyCode: claim.claimFrequencyCode ?? '1',
      // On a replacement/void, carry the payer's original claim control number
      // (ICN/DCN). Maps to 837 REF*F8 — confirm the field path against Stedi docs.
      ...(claim.originalClaimRef
        ? { claimSupplementalInformation: { claimControlNumber: claim.originalClaimRef } }
        : {}),
      // Coordination of benefits: prior payers' adjudication for a secondary claim
      // (837 loop 2320). Confirm the exact field path against Stedi docs.
      ...(claim.otherPayers && claim.otherPayers.length > 0
        ? {
            otherSubscriberInformation: claim.otherPayers.map((op) => ({
              paymentResponsibilityLevelCode: op.sequence,
              otherPayerName: { organizationName: op.payer.name, otherPayerIdentifier: op.payer.externalId },
              payerPaidAmount: money(op.paidCents),
            })),
          }
        : {}),
      signatureIndicator: 'Y',
      planParticipationCode: 'A',
      benefitsAssignmentCertificationIndicator: 'Y',
      releaseInformationCode: 'Y',
      healthCareCodeInformation: claim.diagnoses.map((dx, i) => ({
        diagnosisTypeCode: i === 0 ? 'ABK' : 'ABF',
        diagnosisCode: dx,
      })),
      serviceLines: claim.lines.map((l) => ({
        serviceDate: ymd(claim.dateOfService),
        professionalService: {
          procedureIdentifier: 'HC',
          procedureCode: l.cptHcpcs,
          ...(l.modifiers.length > 0 ? { procedureModifiers: l.modifiers } : {}),
          lineItemChargeAmount: money(l.billedCents),
          measurementUnit: 'UN',
          serviceUnitCount: String(l.units),
          compositeDiagnosisCodePointers: { diagnosisCodePointers: l.diagnosisPointers.map(String) },
        },
        // No reserved X12 delimiter chars (~ * : ^) — payer correlation id per line.
        providerControlNumber: `${claim.controlNumber}L${l.lineNumber}`,
        ...(rp
          ? { renderingProvider: { providerType: 'RenderingProvider', npi: rp.npi, firstName: rp.firstName ?? '', lastName: rp.lastName ?? '' } }
          : {}),
      })),
    },
  }
}

/**
 * A fully-synthetic professional claim for Stedi TEST MODE only. Contains NO real
 * PHI (fake patient + fake member id). usageIndicator "T" + the Stedi Test Payer
 * (STEDITEST) mean Stedi simulates adjudication and returns a test 277CA — it is
 * never routed to a real payer and no money moves.
 */
export function buildStediTestClaim(tradingPartnerServiceId = 'STEDITEST'): Record<string, unknown> {
  return {
    usageIndicator: 'T',
    controlNumber: '000000001',
    tradingPartnerServiceId,
    submitter: {
      organizationName: 'CODECOMPANION TEST CLINIC',
      contactInformation: { name: 'BILLING DEPT', phoneNumber: '5125550100' },
    },
    receiver: { organizationName: 'STEDI TEST PAYER' },
    subscriber: {
      memberId: 'TEST123456789',
      paymentResponsibilityLevelCode: 'P',
      firstName: 'JANE',
      lastName: 'DOE',
      gender: 'F',
      dateOfBirth: '19900101',
      policyNumber: 'TEST123456789',
      address: { address1: '123 TEST ST', city: 'AUSTIN', state: 'TX', postalCode: '78701' },
    },
    providers: [
      {
        providerType: 'BillingProvider',
        npi: '1234567893',
        employerId: '742345678',
        organizationName: 'CODECOMPANION TEST CLINIC',
        address: { address1: '123 MAIN ST', city: 'AUSTIN', state: 'TX', postalCode: '78701' },
        contactInformation: { name: 'BILLING DEPT', phoneNumber: '5125550100' },
      },
      { providerType: 'RenderingProvider', npi: '1234567893', firstName: 'MATTHEW', lastName: 'BLAIR' },
    ],
    claimInformation: {
      claimFilingCode: 'MB',
      patientControlNumber: 'TEST0001',
      claimChargeAmount: '175',
      placeOfServiceCode: '11',
      claimFrequencyCode: '1',
      signatureIndicator: 'Y',
      planParticipationCode: 'A',
      benefitsAssignmentCertificationIndicator: 'Y',
      releaseInformationCode: 'Y',
      healthCareCodeInformation: [
        { diagnosisTypeCode: 'ABK', diagnosisCode: 'E1165' },
        { diagnosisTypeCode: 'ABF', diagnosisCode: 'I10' },
      ],
      serviceLines: [
        {
          serviceDate: '20260115',
          professionalService: {
            procedureIdentifier: 'HC',
            procedureCode: '99214',
            lineItemChargeAmount: '150',
            measurementUnit: 'UN',
            serviceUnitCount: '1',
            compositeDiagnosisCodePointers: { diagnosisCodePointers: ['1', '2'] },
          },
        },
        {
          serviceDate: '20260115',
          professionalService: {
            procedureIdentifier: 'HC',
            procedureCode: '36415',
            lineItemChargeAmount: '25',
            measurementUnit: 'UN',
            serviceUnitCount: '1',
            compositeDiagnosisCodePointers: { diagnosisCodePointers: ['1'] },
          },
        },
      ],
    },
  }
}
