import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { StediClearinghouse, stediFromEnv } from '@/lib/rcm/stedi-clearinghouse'
import { submitClaimBatch } from '@/lib/rcm/submit-batch'
import { pullClaims } from '@/lib/mock-ehr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Submit the synthetic mock-EHR day to the Stedi sandbox (TEST mode) and report
 * per-claim accept/reject. No real PHI (synthetic patients), no real money (test
 * indicator). Refuses to run unless STEDI_SANDBOX is on. The client calls this
 * per claim (or for a subset) so the workbench can show each one process live.
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
    return NextResponse.json({ error: 'Stedi not configured. Set STEDI_API_KEY (and STEDI_SANDBOX=true) and redeploy.' }, { status: 400 })
  }
  if (process.env.STEDI_SANDBOX === 'false') {
    return NextResponse.json({ error: 'Refusing to submit: this workbench runs in sandbox/test mode only. Set STEDI_SANDBOX=true.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { controlNumbers?: string[]; useTestPayer?: boolean }
  const useTestPayer = body.useTestPayer ?? false

  try {
    const all = pullClaims()
    const claims = body.controlNumbers?.length ? all.filter((c) => body.controlNumbers!.includes(c.controlNumber)) : all
    if (claims.length === 0) return NextResponse.json({ error: 'No matching claims to submit.' }, { status: 400 })

    const ch = new StediClearinghouse(stediFromEnv())
    const results = await submitClaimBatch(claims, ch, { useTestPayer, submitterId: process.env.STEDI_SUBMITTER_ID })

    return NextResponse.json({
      sandbox: true,
      useTestPayer,
      submitted: results.length,
      accepted: results.filter((r) => r.outcome === 'accepted').length,
      rejected: results.filter((r) => r.outcome === 'rejected').length,
      blocked: results.filter((r) => r.outcome === 'blocked').length,
      results,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
