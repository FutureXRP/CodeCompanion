/**
 * Run an insurance eligibility (270/271) check from the terminal.
 *   npm run eligibility            # Stedi sandbox if STEDI_API_KEY is set, else the local mock
 *   npm run eligibility -- --mock  # force the local mock (no network/account)
 * Synthetic member data, no PHI. Sandbox/test mode only.
 */
import { MockEligibilityService } from '../lib/rcm/eligibility'
import { StediEligibilityService, stediEligibilityFromEnv, buildStediTestEligibility } from '../lib/rcm/stedi-eligibility'
import { formatCents } from '../lib/canonical'

async function main(): Promise<void> {
  const useMock = process.argv.includes('--mock') || !(process.env.STEDI_ELIGIBILITY_API_KEY || process.env.STEDI_API_KEY)
  if (!useMock && process.env.STEDI_SANDBOX === 'false') {
    console.error('Refusing to run: STEDI_SANDBOX=false. This script is sandbox/test only.')
    process.exit(1)
  }

  const req = buildStediTestEligibility()
  const where = useMock ? 'local mock' : 'Stedi sandbox (test mode)'
  console.log(`Checking eligibility for ${req.subscriber.firstName} ${req.subscriber.lastName} → ${req.payer.name} [${req.payer.externalId}] via ${where}.\n`)

  const service = useMock ? new MockEligibilityService() : new StediEligibilityService(stediEligibilityFromEnv())
  const r = await service.check(req)

  console.log(`  Status:       ${r.status.toUpperCase()}${r.active ? ' ✓' : ''}`)
  if (r.planName) console.log(`  Plan:         ${r.planName}`)
  if (r.copayCents != null) console.log(`  Copay:        ${formatCents(r.copayCents)}`)
  if (r.coinsurancePercent != null) console.log(`  Coinsurance:  ${(r.coinsurancePercent * 100).toFixed(0)}%`)
  if (r.deductibleCents != null) {
    const rem = r.deductibleRemainingCents != null ? ` (${formatCents(r.deductibleRemainingCents)} remaining)` : ''
    console.log(`  Deductible:   ${formatCents(r.deductibleCents)}${rem}`)
  }
  if (r.outOfPocketCents != null) {
    const rem = r.outOfPocketRemainingCents != null ? ` (${formatCents(r.outOfPocketRemainingCents)} remaining)` : ''
    console.log(`  Out-of-pocket: ${formatCents(r.outOfPocketCents)}${rem}`)
  }
  console.log(`  Benefits parsed: ${r.benefits.length}`)
  if (r.errors.length > 0) console.log(`  Errors: ${r.errors.join('; ')}`)
}

main()
