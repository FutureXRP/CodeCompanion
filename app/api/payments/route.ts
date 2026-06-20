import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withTenant, withService } from '@/lib/db/sql'
import { resolveTenantId } from '@/lib/db/tenant'
import { pullClaims, adjudicate } from '@/lib/mock-ehr'
import { buildLedger } from '@/lib/ledger'
import { MockPaymentProvider, toPatientPayment, type PaymentMethod } from '@/lib/payments'
import { recordPayment } from '@/lib/db/operational-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Record a patient payment. Charges via the MOCK provider (the demo never moves
 * real money — Stripe is gated behind ALLOW_REAL_CHARGES). When Neon is configured,
 * the payment + its ledger posting are persisted and audit-logged; without it, the
 * demo runs stateless and returns the recomputed balance only.
 */
export async function POST(request: Request) {
  let userId: string | null = null
  let tenantId: string | null = null

  if (isNeonConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    userId = user.id
    tenantId = await withService((db) => resolveTenantId(db, user.id))
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

    // Persist the payment + ledger posting + audit when wired.
    let persisted = false
    if (isNeonConfigured() && tenantId) {
      const tid = tenantId
      await withTenant(tid, (db) => recordPayment(db, tid, userId, null, charge, result))
      persisted = true
    }

    // Recompute the account balance for the response.
    const claims = pullClaims()
    const remittances = adjudicate(claims)
    const ledger = buildLedger({ claims, remittances, payments: [toPatientPayment(charge, result)] })
    const account = ledger.accounts.find((a) => a.accountKey === accountKey)

    return NextResponse.json({
      result,
      persisted,
      account: account
        ? { accountKey: account.accountKey, patientName: account.patientName, patientArCents: account.balance.patientArCents, standing: account.standing }
        : null,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
