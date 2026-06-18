import { NextResponse } from 'next/server'
import { isServiceRoleConfigured } from '@/lib/db/config'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ensureTenantForUser } from '@/lib/db/tenant'
import { loadFindings } from '@/lib/db/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read the authenticated user's persisted findings — the read side of /api/persist. */
export async function GET() {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 400 })
  }
  try {
    const authed = await createClient()
    const {
      data: { user },
    } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const service = createServiceClient()
    const tenantId = await ensureTenantForUser(service, user.id, user.email ?? 'My Practice')
    const findings = await loadFindings(service, tenantId)

    return NextResponse.json({ tenantId, count: findings.length, findings })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
