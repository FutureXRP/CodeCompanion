import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { StediClearinghouse, stediFromEnv, canonicalToStediClaim } from '@/lib/rcm/stedi-clearinghouse'
import { sampleEncounter, encounterToClaim } from '@/lib/adapters/ehr'
import { loadSampleClaims } from '@/lib/adapters/edi'
import { buildLedger } from '@/lib/ledger'

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
      // Test-mode only: synthetic claim to the Stedi Test Payer, simulated adjudication.
      if (!sandbox) {
        return NextResponse.json({ error: 'Sandbox trials run in test mode only. Set STEDI_SANDBOX=true.' }, { status: 400 })
      }
      const tradingPartnerServiceId = process.env.STEDI_TEST_PAYER_ID || 'STEDITEST'
      // Exercise the real pipeline: synthetic EHR encounter -> canonical -> Stedi JSON.
      const claim = encounterToClaim(sampleEncounter(tradingPartnerServiceId))
      const res = await ch.submitJson(
        canonicalToStediClaim(claim, { tradingPartnerServiceId, usageIndicator: 'T', submitterId: process.env.STEDI_SUBMITTER_ID }),
      )
      return NextResponse.json({ action, sandbox, tradingPartnerServiceId, httpStatus: res.status, raw: res.body })
    }
    if (action === 'status') {
      const statuses = await ch.checkStatus(loadSampleClaims().map((c) => c.controlNumber))
      return NextResponse.json({ action, sandbox, statuses })
    }
    if (action === 'remittances') {
      const remittances = await ch.fetchRemittances()
      return NextResponse.json({ action, sandbox, count: remittances.length, remittances })
    }
    if (action === 'ledger') {
      // Close the loop: fetch the test 835 and POST it into the patient ledger,
      // so submit -> adjudicate -> post -> balance runs end to end in the sandbox.
      const tradingPartnerServiceId = process.env.STEDI_TEST_PAYER_ID || 'STEDITEST'
      const claim = encounterToClaim(sampleEncounter(tradingPartnerServiceId))
      const remittances = await ch.fetchRemittances()
      const matched = remittances.filter((r) => r.claimControlNumber === claim.controlNumber)
      // Post only remittances for this claim; an unmatched charge stays outstanding
      // (awaiting payer) rather than polluting the account with orphan entries.
      const ledger = buildLedger({ claims: [claim], remittances: matched })
      return NextResponse.json({
        action,
        sandbox,
        claimControlNumber: claim.controlNumber,
        remittancesFetched: remittances.length,
        remittancesMatched: matched.length,
        totals: ledger.totals,
        accounts: ledger.accounts,
      })
    }
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
