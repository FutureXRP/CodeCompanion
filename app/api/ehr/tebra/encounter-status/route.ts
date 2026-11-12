import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService } from '@/lib/db/sql'
import { resolveTenantId } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { createTebraSource, tebraConfigFromEnv, type TebraEncounterStatus } from '@/lib/adapters/tebra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED: TebraEncounterStatus[] = ['Approved', 'Rejected']

/**
 * The write path: approve an encounter in Tebra, or send it back to the provider
 * (Rejected = "needs clarification or corrections"). Writes are off unless
 * TEBRA_ALLOW_WRITES=true — except against the synthetic mock, which only
 * changes in-memory state. Every live write is audited.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { encounterId?: string; status?: string }
    const encounterId = (body.encounterId ?? '').trim()
    const status = body.status as TebraEncounterStatus
    if (!encounterId || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: 'encounterId and status (Approved | Rejected) are required.' }, { status: 400 })
    }

    const cfg = tebraConfigFromEnv()
    const writesEnabled = cfg.useMock || process.env.TEBRA_ALLOW_WRITES === 'true'
    if (!writesEnabled) {
      return NextResponse.json({ error: 'Writes to Tebra are off (TEBRA_ALLOW_WRITES). Approve or reject in Tebra directly.' }, { status: 403 })
    }

    // A live write is attributed to a signed-in user and audited; the mock only
    // changes in-memory state, so it needs neither (and works with the login gate off).
    let userId: string | null = null
    let tenantId: string | null = null
    if (isNeonConfigured() && !cfg.useMock) {
      const authed = await createClient()
      const { data: { user } } = await authed.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 })
      userId = user.id
      tenantId = await withService((db) => resolveTenantId(db, user.id))
    }

    const result = await createTebraSource(cfg).updateEncounterStatus(encounterId, status)

    if (tenantId && !cfg.useMock) {
      const tid = tenantId
      await withService((db) => writeAudit(db, tid, userId, { action: 'write', resource: 'tebra_encounter_status', resourceId: encounterId, detail: { status } }))
    }
    return NextResponse.json({ ok: true, ...result, source: cfg.useMock ? 'mock' : 'live' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
