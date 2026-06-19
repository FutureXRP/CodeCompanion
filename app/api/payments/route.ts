import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { pullClaims, adjudicate } from '@/lib/mock-ehr'
import { buildLedger } from '@/lib/ledger'
import { MockPaymentProvider, toPatientPayment, type PaymentMethod } from '@/lib/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Record a patient payment. Charges via the MOCK provider (the demo never moves
 * real money — Stripe is gated behind ALLOW_REAL_CHARGES) and posts the result to
 * the ledger, returning the recomputed account balance so the UI shows it drop.
 * Stateless here (synthetic book each call); a real build persists to Supabase.
 */
export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    accountKey?: string; amountCents?: number; method?: PaymentMethod; patientName?: string
  }
  const accountKey = body.accountKey?.trim()
  const amountCents = Math.round(Number(body.amountCents))
  const method: PaymentMethod = body.method ?? 'card'
  if (!accountKey) return NextResponse.json({ error: 'accountKey is required.' }, { status: 400 })
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be a positive number.' }, { status: 400 })
  }

  try {
    const charge = { accountKey, amountCents, method, patientName: body.patientName }
    const result = await new MockPaymentProvider().charge(charge)
    if (!result.ok) return NextResponse.json({ error: result.error ?? 'Charge failed.' }, { status: 402 })

    // Recompute the account with the payment posted, to return the new balance.
    const claims = pullClaims()
    const remittances = adjudicate(claims)
    const ledger = buildLedger({ claims, remittances, payments: [toPatientPayment(charge, result)] })
    const account = ledger.accounts.find((a) => a.accountKey === accountKey)

    return NextResponse.json({
      result,
      account: account
        ? { accountKey: account.accountKey, patientName: account.patientName, patientArCents: account.balance.patientArCents, standing: account.standing }
        : null,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
