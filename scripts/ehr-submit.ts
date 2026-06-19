/**
 * Submit the mock-EHR day to the Stedi sandbox (TEST mode) from the terminal.
 *   npm run ehr-submit              # route to each claim's real payer id
 *   npm run ehr-submit -- --test-payer   # route all to STEDITEST (reliable accepts)
 * Requires STEDI_API_KEY (+ STEDI_SANDBOX=true). Synthetic data, no money.
 */
import { StediClearinghouse, stediFromEnv } from '../lib/rcm/stedi-clearinghouse'
import { submitClaimBatch } from '../lib/rcm/submit-batch'
import { pullClaims } from '../lib/mock-ehr'

async function main(): Promise<void> {
  if (!process.env.STEDI_API_KEY) {
    console.error('Set STEDI_API_KEY (and STEDI_SANDBOX=true) before running.')
    process.exit(1)
  }
  if (process.env.STEDI_SANDBOX === 'false') {
    console.error('Refusing to run: STEDI_SANDBOX=false. This script is sandbox/test only.')
    process.exit(1)
  }
  const useTestPayer = process.argv.includes('--test-payer')
  const claims = pullClaims()
  console.log(`Submitting ${claims.length} claims to Stedi — ${useTestPayer ? 'STEDITEST' : 'real payer ids'}, test mode (no money).\n`)

  const ch = new StediClearinghouse(stediFromEnv())
  const results = await submitClaimBatch(claims, ch, { useTestPayer, submitterId: process.env.STEDI_SUBMITTER_ID })

  for (const r of results) {
    const tag = r.outcome === 'accepted' ? 'ACCEPTED' : r.outcome === 'rejected' ? 'REJECTED' : 'BLOCKED'
    console.log(`  ${r.controlNumber} ${r.patientName ?? ''} → ${r.payerName} [${r.tradingPartnerServiceId}]: ${tag}${r.category ? ` ${r.category}` : ''} — ${r.detail}`)
  }
  const a = results.filter((r) => r.outcome === 'accepted').length
  const rj = results.filter((r) => r.outcome === 'rejected').length
  const b = results.filter((r) => r.outcome === 'blocked').length
  console.log(`\n${a} accepted · ${rj} rejected · ${b} blocked`)
}

main()
