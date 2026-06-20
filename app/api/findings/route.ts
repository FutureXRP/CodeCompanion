import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService } from '@/lib/db/sql'
import { ensureTenantForUser } from '@/lib/db/tenant'
import { loadFindings } from '@/lib/db/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read the authenticated user's persisted findings — the read side of /api/persist. */
export async function GET() {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: 'Database not configured (DATABASE_URL).' }, { status: 400 })
  }
  try {
    const authed = await createClient()
    const {
      data: { user },
    } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const { tenantId, findings } = await withService(async (db) => {
      const tid = await ensureTenantForUser(db, user.id, user.email ?? 'My Practice', user.email)
      return { tenantId: tid, findings: await loadFindings(db, tid) }
    })

    return NextResponse.json({ tenantId, count: findings.length, findings })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
