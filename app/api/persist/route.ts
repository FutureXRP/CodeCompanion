import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService } from '@/lib/db/sql'
import { ensureTenantForUser } from '@/lib/db/tenant'
import { persistRun } from '@/lib/db/repository'
import { loadClaims, loadRemittances } from '@/lib/adapters/edi'
import { loadFeeSchedule } from '@/lib/adapters/fee-schedule'
import { runDiff } from '@/lib/diff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Persist the current found-money run (sample data by default) into Neon, scoped to
 * the authenticated user's tenant. Supabase identifies the user; the tenant + its
 * membership are created on first save (the service path). Round-trips with
 * GET /api/findings.
 */
export async function POST() {
  if (!isNeonConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured. Set DATABASE_URL (Neon) and run `npm run db:migrate`.' },
      { status: 400 },
    )
  }
  try {
    const authed = await createClient()
    const {
      data: { user },
    } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const claims = loadClaims()
    const remittances = loadRemittances()
    const findings = runDiff(claims, remittances, loadFeeSchedule())

    const result = await withService(async (db) => {
      const tenantId = await ensureTenantForUser(db, user.id, user.email ?? 'My Practice', user.email)
      return persistRun(db, tenantId, { claims, remittances, findings })
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
