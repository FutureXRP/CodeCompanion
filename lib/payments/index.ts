import type { Cents } from '../canonical'
import type { PatientPayment } from '../ledger'

/**
 * Patient payments — taking the money the ledger says the patient owes.
 *
 * The PROVIDER moves the money (mock for demos, Stripe in production); the LEDGER
 * does the accounting. A successful charge becomes a ledger PatientPayment that
 * draws down the patient A/R — the same append-only, deterministic posting the
 * rest of the platform uses. Real card charges move real money, so production is
 * gated (ALLOW_REAL_CHARGES) exactly like the PHI rails.
 */

export type PaymentMethod = 'card' | 'cash' | 'check' | 'ach'
export type PaymentProviderKind = 'mock' | 'stripe'

export interface PaymentRequest {
  accountKey: string
  patientName?: string
  claimControlNumber?: string
  amountCents: Cents
  method: PaymentMethod
}

export interface PaymentResult {
  ok: boolean
  provider: PaymentProviderKind
  amountCents: Cents
  method: PaymentMethod
  transactionId?: string
  receiptUrl?: string
  error?: string
}

export interface PaymentProvider {
  charge(req: PaymentRequest): Promise<PaymentResult>
}

/** Local, no-network payment provider — always succeeds for a positive amount. */
export class MockPaymentProvider implements PaymentProvider {
  async charge(req: PaymentRequest): Promise<PaymentResult> {
    if (!Number.isFinite(req.amountCents) || req.amountCents <= 0) {
      return { ok: false, provider: 'mock', amountCents: req.amountCents, method: req.method, error: 'Amount must be a positive number of cents.' }
    }
    return { ok: true, provider: 'mock', amountCents: req.amountCents, method: req.method, transactionId: `MOCK-${crypto.randomUUID()}` }
  }
}

export interface PaymentConfig {
  provider?: PaymentProviderKind
  /** Real card charges move real money — refuse unless explicitly enabled. */
  allowRealCharges?: boolean
}

/** Provider-agnostic factory. Defaults to mock; Stripe is opt-in and gated. */
export function createPaymentProvider(config: PaymentConfig = {}): PaymentProvider {
  const kind = config.provider ?? (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'mock')
  if (kind === 'mock') return new MockPaymentProvider()

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY). Use the mock provider for testing.')
  }
  if (!config.allowRealCharges) {
    throw new Error(
      'Real card charges are gated — set allowRealCharges (ALLOW_REAL_CHARGES) only after Stripe + reconciliation are verified. Use mock for testing.',
    )
  }
  throw new Error('Stripe payment provider is not implemented yet — wire it behind the PaymentProvider interface.')
}

/** Bridge a successful charge into a ledger PatientPayment to post against the account. */
export function toPatientPayment(req: PaymentRequest, result: PaymentResult, postedAt?: string): PatientPayment {
  return {
    id: result.transactionId,
    accountKey: req.accountKey,
    claimControlNumber: req.claimControlNumber,
    patientName: req.patientName,
    amountCents: req.amountCents,
    method: req.method,
    postedAt,
  }
}
