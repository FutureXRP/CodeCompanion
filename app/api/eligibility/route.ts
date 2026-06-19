import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { MockEligibilityService, type EligibilityRequest } from '@/lib/rcm/eligibility'
import {
  StediEligibilityService,
  stediEligibilityFromEnv,
  buildStediTestEligibility,
} from '@/lib/rcm/stedi-eligibility'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Real-time eligibility (270/271) trials. With no body it checks the synthetic
 * test member (no PHI); pass `request` to check a specific member. Uses the local
 * mock unless STEDI_API_KEY is set (then Stedi sandbox). Production is refused
 * here — eligibility transmits member PHI and is gated by COMPLIANCE.md.
 */
export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { provider?: string; request?: EligibilityRequest }
  const provider = body.provider ?? (process.env.STEDI_API_KEY ? 'stedi' : 'mock')
  const req = body.request ?? buildStediTestEligibility()

  try {
    if (provider === 'mock') {
      const result = await new MockEligibilityService().check(req)
      return NextResponse.json({ provider, sandbox: true, result })
    }

    if (!process.env.STEDI_API_KEY) {
      return NextResponse.json(
        { error: 'Stedi not configured. Set STEDI_API_KEY (and STEDI_SANDBOX=true), or POST { "provider": "mock" }.' },
        { status: 400 },
      )
    }
    const sandbox = process.env.STEDI_SANDBOX !== 'false'
    if (!sandbox) {
      return NextResponse.json(
        { error: 'Eligibility trials run in sandbox/test mode only. Set STEDI_SANDBOX=true.' },
        { status: 400 },
      )
    }
    const raw = await new StediEligibilityService(stediEligibilityFromEnv()).checkRaw(req)
    return NextResponse.json({ provider: 'stedi', sandbox, httpStatus: raw.status, result: raw.result, raw: raw.body })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
