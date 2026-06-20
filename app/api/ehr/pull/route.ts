import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService } from '@/lib/db/sql'
import { ensureTenantForUser } from '@/lib/db/tenant'
import { persistRun } from '@/lib/db/repository'
import { createAthenaSource, athenaConfigFromEnv, pullAthenaEncounters } from '@/lib/adapters/athena'
import { encounterToClaim } from '@/lib/adapters/ehr'
import { adjudicate, mockEhrRates } from '@/lib/mock-ehr'
import { runDiff } from '@/lib/diff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The athena value loop, end to end:
 *   athena pull → canonical claims → (mock 835 until athena payments are wired) →
 *   found-money diff → persist the run to Neon → return the dollar summary.
 *
 * In the hosted app athena is the synthetic mock (ATHENA_USE_MOCK=true — no creds,
 * no PHI gate). Locally with the flags + Preview creds it pulls the real sandbox.
 */
export async function POST(request: Request) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: 'Database not configured. Set DATABASE_URL (Neon).' }, { status: 400 })
  }
  try {
    const authed = await createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as { serviceDateFrom?: string; serviceDateTo?: string }
    const cfg = athenaConfigFromEnv()
    const from = body.serviceDateFrom || new Date().toISOString().slice(0, 10)

    // 1. Pull from athena → canonical claims
    const encounters = await pullAthenaEncounters(createAthenaSource(cfg), { serviceDateFrom: from, serviceDateTo: body.serviceDateTo })
    const claims = encounters.map((e) => encounterToClaim(e, 'athena'))

    // 2. Adjudicate (mock 835 until athena remittances land) + run the found-money diff
    const rates = mockEhrRates()
    const remittances = adjudicate(claims, rates)
    const findings = runDiff(claims, remittances, rates)

    // 3. Persist the run to Neon (best-effort — a hiccup still returns the numbers)
    let persisted = false
    let persistError: string | null = null
    try {
      await withService(async (db) => {
        const tenantId = await ensureTenantForUser(db, user.id, user.email ?? 'My Practice', user.email)
        return persistRun(db, tenantId, { claims, remittances, findings })
      })
      persisted = true
    } catch (e) {
      persistError = e instanceof Error ? e.message : String(e)
    }

    return NextResponse.json({
      ok: true,
      source: cfg.useMock ? 'mock' : 'live-preview',
      serviceDate: from,
      encounters: encounters.length,
      billedCents: claims.reduce((s, c) => s + c.totalBilledCents, 0),
      findings: findings.length,
      recoverableCents: findings.reduce((s, f) => s + f.recoverableCents, 0),
      persisted,
      persistError,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
