import type {
  TebraAppointmentQuery,
  TebraAppointmentRaw,
  TebraChargeQuery,
  TebraChargeRaw,
  TebraEncounterStatus,
  TebraPatientRaw,
  TebraPracticeRaw,
  TebraSource,
} from './types'

/**
 * A read-through cache in front of the live Tebra client. The pages pull on
 * every render, and the account allows 10,000 API calls a month (meter.ts), so
 * identical reads within a window are served from memory: the Workbench, Found
 * Money and the EHR page share one GetCharges call; the Front Desk's per-patient
 * GetPatient lookups are kept for hours (coverage rarely changes within a day).
 * Concurrent misses for one key share a single request. A write through
 * updateEncounterStatus drops the charge entries, so the review queue refreshes.
 *
 * Process-local (one Cloud Run instance); bounded; the mock is never wrapped.
 */

export interface TebraCacheOptions {
  chargesTtlMs?: number
  appointmentsTtlMs?: number
  patientTtlMs?: number
  practicesTtlMs?: number
  maxEntries?: number
  now?: () => number
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DEFAULTS = { chargesTtlMs: 20 * MINUTE, appointmentsTtlMs: 20 * MINUTE, patientTtlMs: 4 * HOUR, practicesTtlMs: 24 * HOUR, maxEntries: 500 }

interface Entry {
  value: unknown
  expiresAt: number
}

/** A key that does not depend on property order or undefined members. */
function stableKey(prefix: string, value: object): string {
  const o = value as Record<string, unknown>
  const body = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${k}=${String(o[k])}`)
    .join('&')
  return `${prefix}:${body}`
}

export class CachedTebraSource implements TebraSource {
  private readonly entries = new Map<string, Entry>()
  private readonly pending = new Map<string, Promise<unknown>>()
  private readonly ttl: Required<Omit<TebraCacheOptions, 'now'>>
  private readonly now: () => number
  private hits = 0
  private misses = 0

  constructor(readonly inner: TebraSource, opts: TebraCacheOptions = {}) {
    this.ttl = { ...DEFAULTS, ...stripUndefined(opts) }
    this.now = opts.now ?? (() => Date.now())
  }

  getCharges(query: TebraChargeQuery): Promise<TebraChargeRaw[]> {
    return this.through(stableKey('charges', query), this.ttl.chargesTtlMs, () => this.inner.getCharges(query))
  }

  getPractices(): Promise<TebraPracticeRaw[]> {
    return this.through('practices:', this.ttl.practicesTtlMs, () => this.inner.getPractices())
  }

  getAppointments(query: TebraAppointmentQuery): Promise<TebraAppointmentRaw[]> {
    return this.through(stableKey('appointments', query), this.ttl.appointmentsTtlMs, () => this.inner.getAppointments(query))
  }

  getPatient(patientId: string): Promise<TebraPatientRaw | null> {
    return this.through(`patient:${patientId}`, this.ttl.patientTtlMs, () => this.inner.getPatient(patientId))
  }

  async updateEncounterStatus(encounterId: string, status: TebraEncounterStatus): Promise<{ encounterId: string; status: TebraEncounterStatus }> {
    const result = await this.inner.updateEncounterStatus(encounterId, status)
    this.invalidate('charges:') // the Draft/Review queue just changed
    return result
  }

  /** Drop entries whose key starts with `prefix` (everything, by default). */
  invalidate(prefix = ''): void {
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.entries.delete(key)
  }

  stats(): { entries: number; hits: number; misses: number } {
    return { entries: this.entries.size, hits: this.hits, misses: this.misses }
  }

  private async through<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<T> {
    const now = this.now()
    const hit = this.entries.get(key)
    if (hit && hit.expiresAt > now) {
      this.hits += 1
      return hit.value as T
    }
    const inFlight = this.pending.get(key)
    if (inFlight) {
      this.hits += 1
      return inFlight as Promise<T>
    }
    this.misses += 1
    const request = fetch()
      .then((value) => {
        if (this.entries.size >= this.ttl.maxEntries) {
          const oldest = this.entries.keys().next().value
          if (oldest !== undefined) this.entries.delete(oldest)
        }
        this.entries.delete(key)
        this.entries.set(key, { value, expiresAt: this.now() + ttlMs })
        return value
      })
      .finally(() => this.pending.delete(key))
    this.pending.set(key, request)
    return request
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v
  return out
}

const minutes = (v: string | undefined, fallbackMs: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n * MINUTE : fallbackMs
}
const hours = (v: string | undefined, fallbackMs: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n * HOUR : fallbackMs
}

export function cacheOptionsFromEnv(env: Record<string, string | undefined> = process.env): TebraCacheOptions {
  const shortTtl = minutes(env.TEBRA_CACHE_TTL_MINUTES, DEFAULTS.chargesTtlMs)
  return {
    chargesTtlMs: shortTtl,
    appointmentsTtlMs: shortTtl,
    patientTtlMs: hours(env.TEBRA_PATIENT_CACHE_HOURS, DEFAULTS.patientTtlMs),
  }
}
