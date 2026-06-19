/**
 * Shared Stedi HTTP plumbing — used by both the claims clearinghouse adapter
 * (stedi-clearinghouse.ts) and the eligibility adapter (stedi-eligibility.ts).
 *
 * Stedi's healthcare APIs share one base URL, one auth scheme (the raw API key
 * in Authorization, no "Bearer"/"Key" prefix), and one test-vs-production switch
 * (usageIndicator "T"/"P"). Keep that knowledge in one place so every Stedi
 * transaction speaks to the API identically and so tests can inject a transport
 * without a network or an account.
 *
 * SAFETY: production ("P", real PHI to real payers) is opt-in everywhere —
 * sandbox ("T", synthetic data) is the default.
 */

/** Stedi healthcare API base URL (us region). Override via STEDI_BASE_URL. */
export const STEDI_BASE_URL = 'https://healthcare.us.stedi.com'

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

/** Default transport over global fetch; parses JSON defensively (never throws on body). */
export const fetchTransport: HttpTransport = async (req) => {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  return { status: res.status, json }
}

/** Auth/config every Stedi adapter needs. Specific adapters extend this. */
export interface StediAuth {
  apiKey: string
  /** Sandbox uses synthetic data + usageIndicator "T"; production uses "P". Default sandbox. */
  sandbox?: boolean
  baseUrl?: string
  /** Injectable for tests; defaults to a global-fetch transport. */
  transport?: HttpTransport
}

/** Stedi expects the raw API key in Authorization (no "Bearer"/"Key" prefix). */
export function stediHeaders(apiKey: string): Record<string, string> {
  return { Authorization: apiKey, 'Content-Type': 'application/json' }
}

/** Sandbox by default — only "P" when production is explicitly requested (sandbox === false). */
export function usageIndicator(sandbox: boolean | undefined): 'T' | 'P' {
  return sandbox === false ? 'P' : 'T'
}

/** Normalize a base URL (strip trailing slashes), falling back to the Stedi default. */
export function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? STEDI_BASE_URL).replace(/\/+$/, '')
}

/** Read shared Stedi auth from the environment. Defaults to sandbox; production is opt-in. */
export function stediAuthFromEnv(): StediAuth {
  const apiKey = process.env.STEDI_API_KEY
  if (!apiKey) throw new Error('STEDI_API_KEY is not set — cannot build a Stedi adapter.')
  return {
    apiKey,
    sandbox: process.env.STEDI_SANDBOX !== 'false', // must explicitly opt into production
    baseUrl: process.env.STEDI_BASE_URL || undefined,
  }
}
