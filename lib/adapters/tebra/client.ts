import type { TebraChargeQuery, TebraChargeRaw, TebraEncounterStatus, TebraPracticeRaw, TebraSource } from './types'
import { escapeXml, extractFirst, extractRecords, extractStringList } from './xml'

/**
 * Tebra Web Services API 2.1 client (SOAP). Builds the envelopes from the
 * Technical Guide's request shapes, POSTs them through an injectable transport,
 * and parses the flat DataContract responses — so request-building, security
 * semantics, throttling and windowing are unit-tested without a network or an
 * account.
 *
 * SAFETY: this is the REAL client — it moves real PHI. createTebraSource gates it
 * behind ALLOW_REAL_PHI; default is the mock.
 *
 * Tebra specifics (guide §2–3):
 *  - RequestHeader {CustomerKey, Password, User} on every call. WCF deserializes
 *    DataContract members in alphabetical order and silently drops out-of-order
 *    elements, so every builder here sorts its fields.
 *  - Text (the password above all) must be XML-escaped or auth fails (§2.2).
 *  - Get operations need at least one Filter; date filters need both ends;
 *    PracticeName is the recommended filter (§3.2).
 *  - Rate limits are per account: GetCharges / GetPayments / GetTransactions
 *    1 call/s, GetPractices 1 per ½s; excess → "429: … requested more than
 *    allowed" (§3.3). Calls are paced and backed off, never dropped.
 *  - SecurityResponse.SecurityResultSuccess is inverted ("True would indicate
 *    that there was an issue", §2.5) — we read Authenticated / Authorized.
 */

export const TEBRA_ENDPOINT = 'https://webservice.kareo.com/services/soap/2.1/KareoServices.svc'
export const TEBRA_NS = 'http://www.kareo.com/api/schemas/'
/** Some request types (ServiceLocation, ProcedureCode) qualify their members with the slash-less namespace. */
export const TEBRA_NS_TYPES = 'http://www.kareo.com/api/schemas'
const MS_PER_DAY = 86_400_000

export interface SoapRequest { url: string; headers: Record<string, string>; body: string }
export interface SoapResponse { status: number; text: string }
export type SoapTransport = (req: SoapRequest) => Promise<SoapResponse>

const fetchTransport: SoapTransport = async (req) => {
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  return { status: res.status, text: await res.text() }
}

/**
 * Where RequestHeader sits among the request's children. WCF reads DataContract
 * members in schema order and silently drops the rest. 'header-first'
 * (RequestHeader, then Filter) is what independently production-tested clients
 * send; 'alphabetical' (Filter, RequestHeader) is the fallback if Tebra ever
 * regenerates its contract and an account reports "not authenticated" with
 * known-good credentials (TEBRA_REQUEST_ORDER).
 */
export type RequestElementOrder = 'header-first' | 'alphabetical'

export interface TebraClientConfig {
  customerKey: string
  user: string
  password: string
  /** Tebra practice name — the recommended filter on every Get (§3.2). */
  practiceName: string
  endpoint?: string
  transport?: SoapTransport
  /** Minimum spacing between calls, ms. Default 1000 (the 1 call/s endpoints). */
  minIntervalMs?: number
  /** Max attempts on throttling (429) / transient 5xx. Default 4. */
  maxAttempts?: number
  /** Widest service-date window per GetCharges call; wider ranges are sliced. Default 60 days. */
  maxWindowDays?: number
  requestOrder?: RequestElementOrder
  /** Injectable backoff sleep (tests pass a recorder). Default real setTimeout. */
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

type Scalar = string | number | boolean | null | undefined

/** Sibling elements in WCF DataContract order (alphabetical); blanks omitted. */
export function xmlFields(fields: Record<string, Scalar>): string {
  return Object.keys(fields)
    .sort()
    .filter((k) => fields[k] !== undefined && fields[k] !== null && fields[k] !== '')
    .map((k) => `<sch:${k}>${escapeXml(String(fields[k]))}</sch:${k}>`)
    .join('')
}

export function soapEnvelope(operation: string, requestInner: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="${TEBRA_NS}" xmlns:sch7="${TEBRA_NS_TYPES}">` +
    `<soapenv:Header/><soapenv:Body><sch:${operation}><sch:request>${requestInner}</sch:request></sch:${operation}>` +
    '</soapenv:Body></soapenv:Envelope>'
  )
}

/** Inclusive [from, to] windows of at most `maxDays` days each (UTC, YYYY-MM-DD). */
export function dateWindows(from: string, to: string, maxDays: number): [string, string][] {
  const span = Math.max(1, Math.floor(maxDays))
  const end = isoToUtc(to)
  const out: [string, string][] = []
  for (let start = isoToUtc(from); start <= end; ) {
    const windowEnd = Math.min(end, start + (span - 1) * MS_PER_DAY)
    out.push([utcToIso(start), utcToIso(windowEnd)])
    start = windowEnd + MS_PER_DAY
  }
  return out
}

function isoToUtc(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Expected a YYYY-MM-DD date, got "${iso}".`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export type WindowKind = 'service' | 'posting' | 'modified'

/** The date window a query is sliced on: the first pair present, both ends resolved. */
export function resolveWindow(query: TebraChargeQuery): { kind: WindowKind; from: string; to: string } {
  if (query.serviceDateFrom) return { kind: 'service', from: query.serviceDateFrom, to: query.serviceDateTo ?? query.serviceDateFrom }
  if (query.postingDateFrom) return { kind: 'posting', from: query.postingDateFrom, to: query.postingDateTo ?? query.postingDateFrom }
  if (query.modifiedDateFrom) return { kind: 'modified', from: query.modifiedDateFrom, to: query.modifiedDateTo ?? query.modifiedDateFrom }
  throw new Error('GetCharges needs a date window: service, posting, or last-modified dates (guide §3.2 — both ends).')
}

/** The date filter fields for one slice: the sliced pair plus the other pairs as given. */
export function windowFields(query: TebraChargeQuery, kind: WindowKind, from: string, to: string): Record<string, string | undefined> {
  const pair = (f?: string, t?: string) => (f ? { from: f, to: t ?? f } : undefined)
  const service = kind === 'service' ? { from, to } : pair(query.serviceDateFrom, query.serviceDateTo)
  const posting = kind === 'posting' ? { from, to } : pair(query.postingDateFrom, query.postingDateTo)
  const modified = kind === 'modified' ? { from, to } : pair(query.modifiedDateFrom, query.modifiedDateTo)
  return {
    FromServiceDate: service?.from,
    ToServiceDate: service?.to,
    FromPostingDate: posting?.from,
    ToPostingDate: posting?.to,
    FromLastModifiedDate: modified?.from,
    ToLastModifiedDate: modified?.to,
  }
}

function utcToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

const isThrottle = (msg: string) => /\b429\b/.test(msg) || /requested more than allowed/i.test(msg)
const isTrue = (v: string | undefined) => /^true$/i.test((v ?? '').trim())
const isFalse = (v: string | undefined) => /^false$/i.test((v ?? '').trim())

export class TebraClient implements TebraSource {
  private readonly endpoint: string
  private readonly transport: SoapTransport
  private readonly minIntervalMs: number
  private readonly maxAttempts: number
  private readonly maxWindowDays: number
  private readonly requestOrder: RequestElementOrder
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private lastCallAt = 0

  constructor(private readonly cfg: TebraClientConfig) {
    if (!cfg.customerKey || !cfg.user || !cfg.password || !cfg.practiceName) {
      throw new Error('TebraClient requires customerKey, user, password, and practiceName.')
    }
    this.endpoint = (cfg.endpoint ?? TEBRA_ENDPOINT).replace(/\/+$/, '')
    this.transport = cfg.transport ?? fetchTransport
    this.minIntervalMs = Math.max(0, cfg.minIntervalMs ?? 1000)
    this.maxAttempts = Math.max(1, cfg.maxAttempts ?? 4)
    this.maxWindowDays = Math.max(1, cfg.maxWindowDays ?? 60)
    this.requestOrder = cfg.requestOrder ?? 'header-first'
    this.sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.now = cfg.now ?? (() => Date.now())
  }

  /** The RequestHeader every call carries (§2.3) — alphabetical for WCF. */
  requestHeader(): string {
    const fields = xmlFields({ CustomerKey: this.cfg.customerKey, Password: this.cfg.password, User: this.cfg.user })
    return `<sch:RequestHeader>${fields}</sch:RequestHeader>`
  }

  /** The `<request>` children: header + the operation's own elements (Fields omitted → full records). */
  requestBody(inner: string): string {
    return this.requestOrder === 'alphabetical' ? inner + this.requestHeader() : this.requestHeader() + inner
  }

  /** Charges for a date window, sliced into ≤ maxWindowDays calls, de-duped by charge ID. */
  async getCharges(query: TebraChargeQuery): Promise<TebraChargeRaw[]> {
    const { kind, from, to } = resolveWindow(query)
    if (isoToUtc(to) < isoToUtc(from)) throw new Error(`The ${kind}-date window's end precedes its start.`)

    const seen = new Set<string>()
    const rows: TebraChargeRaw[] = []
    for (const [windowFrom, windowTo] of dateWindows(from, to, this.maxWindowDays)) {
      const filter = xmlFields({
        ...windowFields(query, kind, windowFrom, windowTo),
        EncounterStatus: query.encounterStatus,
        IncludeUnapprovedCharges: query.includeUnapproved ? 'T' : undefined,
        PracticeName: this.cfg.practiceName,
      })
      const xml = await this.call('GetCharges', this.requestBody(`<sch:Filter>${filter}</sch:Filter>`))
      for (const record of extractRecords(xml, 'ChargeData')) {
        const key = record.ID || `${record.EncounterID}|${record.ProcedureCode}|${record.ServiceStartDate}|${rows.length}`
        if (seen.has(key)) continue
        seen.add(key)
        // The response has no approval column — keep the state we asked for on the row.
        if (query.encounterStatus && !record.EncounterStatus) record.EncounterStatus = query.encounterStatus
        rows.push(record)
      }
    }
    return rows
  }

  async getPractices(): Promise<TebraPracticeRaw[]> {
    const xml = await this.call('GetPractices', this.requestBody(`<sch:Filter>${xmlFields({ PracticeName: this.cfg.practiceName })}</sch:Filter>`))
    return extractRecords(xml, 'PracticeData')
  }

  /**
   * UpdateEncounterStatus (guide §4.21): only Draft/Review encounters can be
   * moved. Request members in WCF order: EncounterID, EncounterStatus, Practice.
   */
  async updateEncounterStatus(encounterId: string, status: TebraEncounterStatus): Promise<{ encounterId: string; status: TebraEncounterStatus }> {
    if (!encounterId.trim()) throw new Error('updateEncounterStatus needs an encounter id.')
    if (!['Draft', 'Review', 'Approved', 'Rejected'].includes(status)) throw new Error(`Unsupported encounter status "${status}".`)
    const inner =
      xmlFields({ EncounterID: encounterId, EncounterStatus: status }) +
      `<sch:Practice>${xmlFields({ PracticeName: this.cfg.practiceName })}</sch:Practice>`
    await this.call('UpdateEncounterStatus', this.requestBody(inner))
    return { encounterId, status }
  }

  /**
   * One SOAP operation: pace → POST → retry on throttling / transient 5xx →
   * surface faults, ErrorResponse and security failures as readable errors →
   * return the response XML.
   */
  async call(operation: string, requestInner: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < this.maxAttempts - 1
      await this.pace()
      const res = await this.transport({
        url: this.endpoint,
        // Quoted, and with the contract segment — WCF answers "ContractFilter mismatch" (HTTP 500) without it.
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${TEBRA_NS}KareoServices/${operation}"` },
        body: soapEnvelope(operation, requestInner),
      })

      const fault = extractFirst(res.text, 'Fault')
      if (fault) throw new Error(`Tebra ${operation} SOAP fault: ${fault.faultstring || fault.Text || 'unknown fault'}`)

      if (res.status === 429 || res.status >= 500) {
        if (!canRetry) throw new Error(`Tebra ${operation} failed (HTTP ${res.status}).`)
        await this.sleep(this.backoff(attempt))
        continue
      }
      if (res.status >= 300) throw new Error(`Tebra ${operation} failed (HTTP ${res.status}).`)

      const err = extractFirst(res.text, 'ErrorResponse')
      if (err && isTrue(err.IsError)) {
        const message = err.ErrorMessage || 'unknown error'
        if (isThrottle(message) && canRetry) {
          await this.sleep(this.backoff(attempt))
          continue
        }
        throw new Error(`Tebra ${operation} error: ${message}`)
      }

      const security = extractFirst(res.text, 'SecurityResponse')
      if (security) {
        if (isFalse(security.Authenticated)) {
          throw new Error(
            `Tebra ${operation}: not authenticated — check TEBRA_CUSTOMER_KEY / TEBRA_USER / TEBRA_PASSWORD` +
              (security.SecurityResult ? ` (${security.SecurityResult})` : '') + '.',
          )
        }
        if (isFalse(security.Authorized)) {
          const missing = extractStringList(res.text, 'PermissionsMissing')
          throw new Error(
            `Tebra ${operation}: user not authorized` +
              (missing.length ? ` — missing permissions: ${missing.join(', ')}` : '') +
              '. The API user needs the System Admin role (guide §1.2).',
          )
        }
      }
      return res.text
    }
  }

  /** Keep ≥ minIntervalMs between calls (the account-level rate limit). */
  private async pace(): Promise<void> {
    const wait = this.lastCallAt + this.minIntervalMs - this.now()
    if (wait > 0) await this.sleep(wait)
    this.lastCallAt = this.now()
  }

  private backoff(attempt: number): number {
    return Math.max(this.minIntervalMs, 1000 * 2 ** attempt)
  }
}
