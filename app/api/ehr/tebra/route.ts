import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService } from '@/lib/db/sql'
import { ensureTenantForUser } from '@/lib/db/tenant'
import { persistRun } from '@/lib/db/repository'
import { createTebraSource, tebraConfigFromEnv } from '@/lib/adapters/tebra'
import { runTebraFoundMoney } from '@/lib/found-money/tebra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MS_PER_DAY = 86_400_000
const daysBefore = (iso: string, days: number) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() - days * MS_PER_DAY).toISOString().slice(0, 10)

/**
 * The Tebra value loop, end to end:
 *   Tebra GetCharges → canonical claims + remittances + contract rates →
 *   found-money diff → persist the run to Neon → return the dollar summary.
 *
 * No mock-adjudication step here (unlike the athena route): a Tebra charge
 * record already carries what the payer did. In the hosted app Tebra is the
 * synthetic mock (TEBRA_USE_MOCK=true — no creds, no PHI gate); locally with
 * the flags + a Customer Key it reads the real practice.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { serviceDateFrom?: string; serviceDateTo?: string }
    const cfg = tebraConfigFromEnv()
    const today = new Date().toISOString().slice(0, 10)
    const to = body.serviceDateTo || body.serviceDateFrom || today
    const from = body.serviceDateFrom || (cfg.useMock ? to : daysBefore(to, 30))

    const { claims, remittances, feeSchedule, report, workbench } = await runTebraFoundMoney(createTebraSource(cfg), {
      serviceDateFrom: from,
      serviceDateTo: to,
    })

    // Persist the run to Neon (best-effort — a hiccup still returns the numbers)
    let persisted = false
    let persistError: string | null = null
    if (!isNeonConfigured()) {
      persistError = 'Database not configured (DATABASE_URL).'
    } else {
      try {
        const authed = await createClient()
        const { data: { user } } = await authed.auth.getUser()
        if (!user) throw new Error('Not authenticated. Please sign in.')
        await withService(async (db) => {
          const tenantId = await ensureTenantForUser(db, user.id, user.email ?? 'My Practice', user.email)
          return persistRun(db, tenantId, { claims, remittances, findings: report.findings })
        })
        persisted = true
      } catch (e) {
        persistError = e instanceof Error ? e.message : String(e)
      }
    }

    const expectedCents = claims.reduce(
      (sum, c) => sum + c.lines.reduce((s, l) => s + (feeSchedule.rate(c.payer.externalId, l.cptHcpcs, l.modifiers[0]) ?? 0), 0),
      0,
    )
    return NextResponse.json({
      ok: true,
      source: cfg.useMock ? 'mock' : 'live',
      serviceDateFrom: from,
      serviceDateTo: to,
      encounters: claims.length,
      lines: report.meta.lineCount,
      billedCents: claims.reduce((s, c) => s + c.totalBilledCents, 0),
      expectedCents,
      paidCents: remittances.reduce((s, r) => s + r.totalPaidCents, 0),
      contractRates: feeSchedule.size,
      findings: report.totals.count,
      recoverableCents: report.totals.recoverableCents,
      byType: report.totals.byType,
      workbench: { items: workbench.items.length, atStakeCents: workbench.atStakeCents },
      persisted,
      persistError,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
