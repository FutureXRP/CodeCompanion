import type { Claim } from '../canonical'
import { canonicalToStediClaim } from './stedi-clearinghouse'
import { scrubClaim, OKLAHOMA, type Jurisdiction } from '../scrub'

/**
 * Submit a batch of claims to Stedi and report per-claim outcomes — the billing
 * workbench's backend. Each claim is scrubbed first (errors block it, never
 * transmitted), then submitted in TEST mode (usageIndicator "T") to the Stedi
 * sandbox, and the 277CA response is classified accepted / rejected. No real
 * money, no real payer routing unless explicitly enabled.
 */

/** Minimal Stedi surface this needs — injectable so the batch is unit-testable. */
export interface JsonSubmitter {
  submitJson(payload: unknown): Promise<{ status: number; body: unknown }>
}

export type SubmitOutcome = 'accepted' | 'rejected' | 'blocked'

export interface ClaimSubmitResult {
  controlNumber: string
  patientName?: string
  payerName: string
  /** Where it was actually routed (real payer id or the test payer). */
  tradingPartnerServiceId: string
  outcome: SubmitOutcome
  /** 277CA status category (A1/A2 accepted, A3+ rejected), when present. */
  category?: string
  /** Reject/block reason or acceptance note. */
  detail: string
  httpStatus?: number
  /** Raw Stedi response, so the real result is always visible. */
  raw?: unknown
}

export interface SubmitBatchOptions {
  jurisdiction?: Jurisdiction
  /** Route every claim to the test payer instead of its real payer id. */
  useTestPayer?: boolean
  testPayerId?: string
  submitterId?: string
}

interface StediBody {
  status?: string
  controlNumber?: string
  claimReference?: string
  x12?: string
  errors?: { message?: string; description?: string; code?: string }[]
  edits?: { message?: string; description?: string; code?: string }[]
  error?: string
  message?: string
}

function errText(items: { message?: string; description?: string; code?: string }[] | undefined): string | undefined {
  if (!items || items.length === 0) return undefined
  return items.map((e) => e.message ?? e.description ?? e.code ?? JSON.stringify(e)).join('; ')
}

/** First 277CA claim-status category in the X12 (STC01 composite, e.g. "A1:20:PR"). */
function stcCategory(x12: string): string | undefined {
  return x12.match(/STC\*([A-Z]\d+)/)?.[1]
}

/**
 * Classify a Stedi JSON submission response. Defensive: any HTTP error, error/edit
 * list, non-SUCCESS status, or A3+ 277CA category is a rejection; otherwise the
 * claim was accepted for processing (A1/A2).
 */
export function classifyStediSubmission(httpStatus: number, body: unknown): { outcome: 'accepted' | 'rejected'; category?: string; detail: string } {
  const b = (body ?? {}) as StediBody
  const x12 = typeof b.x12 === 'string' ? b.x12 : ''
  const category = stcCategory(x12)
  const errs = errText(b.errors) ?? errText(b.edits) ?? b.error ?? (b.status && b.status !== 'SUCCESS' ? b.message ?? b.status : undefined)

  if (httpStatus >= 300 || errs) {
    return { outcome: 'rejected', category, detail: errs ?? `Clearinghouse rejected the claim (HTTP ${httpStatus}).` }
  }
  if (category && /^A[3467]/.test(category)) {
    return { outcome: 'rejected', category, detail: `Payer front-end rejected the claim (277CA ${category}).` }
  }
  return { outcome: 'accepted', category: category ?? 'A1', detail: category ? `Accepted for processing (277CA ${category}).` : 'Accepted for processing.' }
}

const TEST_PAYER = 'STEDITEST'

export async function submitClaimBatch(
  claims: Claim[],
  ch: JsonSubmitter,
  opts: SubmitBatchOptions = {},
): Promise<ClaimSubmitResult[]> {
  const jurisdiction = opts.jurisdiction ?? OKLAHOMA
  const testPayerId = opts.testPayerId ?? TEST_PAYER
  const results: ClaimSubmitResult[] = []

  for (const claim of claims) {
    const patientName = claim.subscriber ? `${claim.subscriber.firstName} ${claim.subscriber.lastName}` : undefined
    const tradingPartnerServiceId = opts.useTestPayer ? testPayerId : claim.payer.externalId

    const scrub = scrubClaim(claim, jurisdiction)
    if (!scrub.ok) {
      const reasons = scrub.findings.filter((f) => f.severity === 'error').map((f) => `${f.code}: ${f.message}`).join(' · ')
      results.push({ controlNumber: claim.controlNumber, patientName, payerName: claim.payer.name, tradingPartnerServiceId, outcome: 'blocked', detail: reasons || 'Failed pre-submission scrub.' })
      continue
    }

    try {
      const payload = canonicalToStediClaim(claim, { tradingPartnerServiceId, usageIndicator: 'T', submitterId: opts.submitterId })
      const res = await ch.submitJson(payload)
      const verdict = classifyStediSubmission(res.status, res.body)
      results.push({ controlNumber: claim.controlNumber, patientName, payerName: claim.payer.name, tradingPartnerServiceId, outcome: verdict.outcome, category: verdict.category, detail: verdict.detail, httpStatus: res.status, raw: res.body })
    } catch (e) {
      results.push({ controlNumber: claim.controlNumber, patientName, payerName: claim.payer.name, tradingPartnerServiceId, outcome: 'rejected', detail: e instanceof Error ? e.message : String(e) })
    }
  }

  return results
}
