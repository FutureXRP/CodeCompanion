import { athenaDate } from './to-canonical'
import type {
  AthenaSource,
  AthenaEncounterQuery,
  AthenaEncounterBundle,
  AthenaClaimRaw,
  AthenaPatientRaw,
  AthenaInsuranceRaw,
  AthenaProviderRaw,
} from './types'

/**
 * athenahealth REST client — OAuth2 client-credentials + a defensive GET, and a
 * getEncounterBundles orchestration that pulls a day's claims + the patient,
 * insurance, and provider for each, joined into AthenaEncounterBundles.
 *
 * SAFETY: this is the REAL client — it moves real PHI. createAthenaSource gates
 * it behind ALLOW_REAL_PHI; default is the mock. The HTTP transport is injectable
 * so OAuth + request-building are unit-tested without a network or an account.
 *
 * Endpoint paths and field names follow athenahealth's documented API; confirm
 * against developer.athenahealth.com before live use (some shapes vary by tenant
 * and are paginated — list() tolerates array | {<key>:[…]} | {results:[…]}).
 */

export interface HttpResponse { status: number; json: unknown }
export interface HttpRequest { method: string; url: string; headers: Record<string, string>; body?: string }
export type HttpTransport = (req: HttpRequest) => Promise<HttpResponse>

const fetchTransport: HttpTransport = async (req) => {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try { json = JSON.parse(text) } catch { json = { raw: text } }
  }
  return { status: res.status, json }
}

export const ATHENA_PREVIEW_BASE = 'https://api.preview.platform.athenahealth.com'
export const ATHENA_PROD_BASE = 'https://api.platform.athenahealth.com'
const DEFAULT_SCOPE = 'athena/service/Athenanet.MDP.*'

export interface AthenaClientConfig {
  clientId: string
  clientSecret: string
  practiceId: string
  baseUrl?: string
  scope?: string
  transport?: HttpTransport
  /** Max attempts on athena throttling (HTTP 429) / transient 503. Default 4. */
  maxAttempts?: number
  /** Injectable backoff sleep (tests pass a no-op). Default real setTimeout. */
  sleep?: (ms: number) => Promise<void>
}

export class AthenaClient implements AthenaSource {
  private token: { value: string; expiresAt: number } | null = null
  private readonly base: string
  private readonly transport: HttpTransport
  private readonly maxAttempts: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly cfg: AthenaClientConfig) {
    if (!cfg.clientId || !cfg.clientSecret || !cfg.practiceId) {
      throw new Error('AthenaClient requires clientId, clientSecret, and practiceId.')
    }
    this.base = (cfg.baseUrl ?? ATHENA_PREVIEW_BASE).replace(/\/+$/, '')
    this.transport = cfg.transport ?? fetchTransport
    this.maxAttempts = Math.max(1, cfg.maxAttempts ?? 4)
    this.sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  /**
   * Transport with exponential backoff on athena throttling (HTTP 429) and
   * transient 503s. athena does not publish numeric rate limits, so the daily
   * pull must stay polite (API ToS §1(b)). Waits 0.5s, 1s, 2s, … between tries.
   */
  private async send(req: HttpRequest): Promise<HttpResponse> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.transport(req)
      if ((res.status === 429 || res.status === 503) && attempt < this.maxAttempts - 1) {
        await this.sleep(2 ** attempt * 500)
        continue
      }
      return res
    }
  }

  /** OAuth2 client-credentials token, cached until ~60s before expiry. */
  async getToken(): Promise<string> {
    const now = Date.now()
    if (this.token && this.token.expiresAt > now + 60_000) return this.token.value
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64')
    const res = await this.send({
      method: 'POST',
      url: `${this.base}/oauth2/v1/token`,
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(this.cfg.scope ?? DEFAULT_SCOPE)}`,
    })
    const body = (res.json ?? {}) as { access_token?: string; expires_in?: number }
    if (res.status >= 300 || !body.access_token) throw new Error(`Athena OAuth token request failed (HTTP ${res.status}).`)
    this.token = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 }
    return this.token.value
  }

  private async get<T = unknown>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    const token = await this.getToken()
    const qs = query
      ? '?' + Object.entries(query).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
      : ''
    const res = await this.send({ method: 'GET', url: `${this.base}/v1/${this.cfg.practiceId}${path}${qs}`, headers: { Authorization: `Bearer ${token}` } })
    if (res.status >= 300) throw new Error(`Athena GET ${path} failed (HTTP ${res.status}).`)
    return res.json as T
  }

  /** athena resources come back as an array or paginated under a key. */
  private static list<T>(json: unknown, key: string): T[] {
    if (Array.isArray(json)) return json as T[]
    const o = (json ?? {}) as Record<string, unknown>
    const v = o[key] ?? o.results
    return Array.isArray(v) ? (v as T[]) : []
  }

  async getEncounterBundles(query: AthenaEncounterQuery): Promise<AthenaEncounterBundle[]> {
    const from = toAthenaDate(query.serviceDateFrom)
    const to = toAthenaDate(query.serviceDateTo ?? query.serviceDateFrom)
    const claims = AthenaClient.list<AthenaClaimRaw>(await this.get('/claims', { servicedatefrom: from, servicedateto: to, departmentid: query.departmentId }), 'claims')

    const patients = new Map<string, AthenaPatientRaw>()
    const insurances = new Map<string, AthenaInsuranceRaw>()
    const providers = new Map<string, AthenaProviderRaw>()
    const bundles: AthenaEncounterBundle[] = []

    for (const claim of claims) {
      const patientId = String(claim.patientid ?? '')
      const providerId = String(claim.providerid ?? '')
      if (!patientId) continue

      if (!patients.has(patientId)) {
        const pj = await this.get(`/patients/${patientId}`)
        patients.set(patientId, AthenaClient.list<AthenaPatientRaw>(pj, 'patients')[0] ?? (pj as AthenaPatientRaw) ?? {})
      }
      if (!insurances.has(patientId)) {
        const ins = AthenaClient.list<AthenaInsuranceRaw>(await this.get(`/patients/${patientId}/insurances`), 'insurances')
        insurances.set(patientId, ins.find((i) => String(i.sequencenumber) === '1') ?? ins[0] ?? {})
      }
      if (providerId && !providers.has(providerId)) {
        const prj = await this.get(`/providers/${providerId}`)
        providers.set(providerId, AthenaClient.list<AthenaProviderRaw>(prj, 'providers')[0] ?? (prj as AthenaProviderRaw) ?? {})
      }

      bundles.push({
        encounterId: String(claim.encounterid ?? claim.claimid ?? ''),
        patientControlNumber: patientId,
        dateOfService: athenaDate(claim.servicedate),
        placeOfService: claim.placeofservice,
        claimFilingCode: claim.claimcategory,
        patient: patients.get(patientId) ?? {},
        insurance: insurances.get(patientId) ?? {},
        provider: providers.get(providerId) ?? {},
        charges: claim.charges ?? [],
      })
    }
    return bundles
  }
}

/** YYYY-MM-DD -> MM/DD/YYYY (athena query format). */
function toAthenaDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso
}
