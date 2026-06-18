import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { StediClearinghouse, stediFromEnv } from '@/lib/rcm/stedi-clearinghouse'
import { generate837, loadSampleClaims } from '@/lib/adapters/edi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Live Stedi sandbox trials. Submits the synthetic sample claims (no real PHI)
 * and returns the raw response so the submission rail can be verified end to
 * end. Requires a login when auth is enabled; requires STEDI_API_KEY always.
 */
export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (!process.env.STEDI_API_KEY) {
    return NextResponse.json(
      { error: 'Stedi not configured. Set STEDI_API_KEY (and STEDI_SANDBOX=true) and redeploy.' },
      { status: 400 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  const action = body.action ?? 'submit'
  const sandbox = process.env.STEDI_SANDBOX !== 'false'

  try {
    const ch = new StediClearinghouse(stediFromEnv())

    if (action === 'submit') {
      const raw = await ch.submitRaw(generate837(loadSampleClaims()))
      return NextResponse.json({ action, sandbox, httpStatus: raw.status, acks: raw.acks, raw: raw.body })
    }
    if (action === 'status') {
      const statuses = await ch.checkStatus(loadSampleClaims().map((c) => c.controlNumber))
      return NextResponse.json({ action, sandbox, statuses })
    }
    if (action === 'remittances') {
      const remittances = await ch.fetchRemittances()
      return NextResponse.json({ action, sandbox, count: remittances.length, remittances })
    }
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
