import { NextResponse } from 'next/server'
import type { Claim } from '@/lib/canonical'
import { generate837 } from '@/lib/adapters/edi'
import { scrubClaim, OKLAHOMA } from '@/lib/scrub'
import { adjudicate, mockEhrRates } from '@/lib/mock-ehr'
import { runDiff } from '@/lib/diff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The sandbox claim lifecycle for one (edited) encounter:
 *   edited claim → 837 EDI (real generator) → scrub → 835/ERA adjudication →
 *   found-money diff. Pure + synthetic; no PHI, no real submission. The 835 is the
 *   payer's electronic EOB (the patient statement is deliberately NOT called an EOB).
 */
export async function POST(request: Request) {
  try {
    const { claim } = (await request.json()) as { claim?: Claim }
    if (!claim || !Array.isArray(claim.lines) || claim.lines.length === 0) {
      return NextResponse.json({ error: 'Provide a claim with at least one line.' }, { status: 400 })
    }

    // Recompute the total from the (possibly edited) line charges.
    const c: Claim = { ...claim, totalBilledCents: claim.lines.reduce((s, l) => s + (Number(l.billedCents) || 0), 0) }
    const rates = mockEhrRates()

    const edi837 = safe(() => generate837([c], { submitterId: 'SANDBOX', controlNumber: '000000001' }))
    const scrub = scrubClaim(c, OKLAHOMA)
    const remittances = adjudicate([c], rates)
    const findings = runDiff([c], remittances, rates)

    return NextResponse.json({ ok: true, edi837, scrub, remittance: remittances[0] ?? null, findings })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

function safe(fn: () => string): string | null {
  try {
    return fn()
  } catch {
    return null // a malformed edit (e.g. blank CPT) still returns the rest
  }
}
