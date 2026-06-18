import { NextResponse } from 'next/server'
import { isServiceRoleConfigured, DEFAULT_TENANT_NAME } from '@/lib/db/config'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureTenant, persistRun } from '@/lib/db/repository'
import { loadClaims, loadRemittances } from '@/lib/adapters/edi'
import { loadFeeSchedule } from '@/lib/adapters/fee-schedule'
import { runDiff } from '@/lib/diff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Persist the current found-money run (sample data by default) into Supabase,
 * server-side via the service role. Round-trips with GET /api/findings.
 * No-ops with a clear error until Supabase is configured + migrations applied.
 */
export async function POST() {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and apply migrations 005 + 006.' },
      { status: 400 },
    )
  }
  try {
    const claims = loadClaims()
    const remittances = loadRemittances()
    const feeSchedule = loadFeeSchedule()
    const findings = runDiff(claims, remittances, feeSchedule)

    const db = createServiceClient()
    const tenantId = await ensureTenant(db, DEFAULT_TENANT_NAME)
    const result = await persistRun(db, tenantId, { claims, remittances, findings })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
