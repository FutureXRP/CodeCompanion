import { NextResponse } from 'next/server'
import { isServiceRoleConfigured } from '@/lib/db/config'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ensureTenantForUser } from '@/lib/db/tenant'
import { persistRun } from '@/lib/db/repository'
import { loadClaims, loadRemittances } from '@/lib/adapters/edi'
import { loadFeeSchedule } from '@/lib/adapters/fee-schedule'
import { runDiff } from '@/lib/diff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Persist the current found-money run (sample data by default) into Supabase,
 * scoped to the authenticated user's tenant. Writes run via the service role
 * (shared payer catalog + first tenant membership need it); the auth check
 * ensures the data lands in the caller's own tenant. Round-trips with
 * GET /api/findings.
 */
export async function POST() {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and run the schema SQL.' },
      { status: 400 },
    )
  }
  try {
    const authed = await createClient()
    const {
      data: { user },
    } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const service = createServiceClient()
    const tenantId = await ensureTenantForUser(service, user.id, user.email ?? 'My Practice')

    const claims = loadClaims()
    const remittances = loadRemittances()
    const findings = runDiff(claims, remittances, loadFeeSchedule())
    const result = await persistRun(service, tenantId, { claims, remittances, findings })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
