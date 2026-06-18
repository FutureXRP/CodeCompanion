import { NextResponse } from 'next/server'
import { isServiceRoleConfigured, DEFAULT_TENANT_NAME } from '@/lib/db/config'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureTenant, loadFindings } from '@/lib/db/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read persisted findings for the bootstrap tenant — the read side of /api/persist. */
export async function GET() {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 400 })
  }
  try {
    const db = createServiceClient()
    const tenantId = await ensureTenant(db, DEFAULT_TENANT_NAME)
    const findings = await loadFindings(db, tenantId)
    return NextResponse.json({ tenantId, count: findings.length, findings })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
