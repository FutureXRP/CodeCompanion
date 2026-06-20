/**
 * Pull a day (or range) of encounters from athenahealth and print them — proves the
 * OAuth + pull + canonical mapping work end to end. Synthetic Preview data only.
 *
 *   npm run athena-pull                            # service date = today
 *   npm run athena-pull -- 2026-01-15              # one day
 *   npm run athena-pull -- 2026-01-01 2026-01-31   # a date range
 *
 * Reads ATHENA_* from .env.local. For the live client against the Preview sandbox:
 *   ATHENA_USE_MOCK=false, ALLOW_REAL_PHI=true (staging only — Preview is synthetic),
 *   ATHENA_CLIENT_ID, ATHENA_CLIENT_SECRET, ATHENA_PRACTICE_ID=195900,
 *   ATHENA_BASE_URL=https://api.preview.platform.athenahealth.com
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { createAthenaSource, athenaConfigFromEnv, pullAthenaEncounters } from '../lib/adapters/athena'
import { encounterToClaim } from '../lib/adapters/ehr'
import { formatCents } from '../lib/canonical'

async function main(): Promise<void> {
  const from = process.argv[2] || new Date().toISOString().slice(0, 10)
  const to = process.argv[3] || from
  const cfg = athenaConfigFromEnv()

  console.log('athena pull')
  console.log(`  mode:     ${cfg.useMock ? 'MOCK (synthetic, no network)' : 'LIVE client'}`)
  console.log(`  base:     ${cfg.baseUrl ?? '(preview default)'}`)
  console.log(`  practice: ${cfg.practiceId ?? '(unset)'}`)
  console.log(`  dates:    ${from}${to !== from ? ` .. ${to}` : ''}\n`)

  const source = createAthenaSource(cfg)
  const encounters = await pullAthenaEncounters(source, { serviceDateFrom: from, serviceDateTo: to })

  console.log(`Pulled ${encounters.length} encounter(s).\n`)
  let total = 0
  for (const e of encounters.slice(0, 10)) {
    const claim = encounterToClaim(e, 'athena')
    total += claim.totalBilledCents
    console.log(`• ${e.dateOfService}  patient ${e.patientControlNumber}  ${e.payer.name}`)
    console.log(`    ${e.lines.length} line(s): ${e.lines.map((l) => l.cptHcpcs).join(', ')}   billed ${formatCents(claim.totalBilledCents)}`)
  }
  if (encounters.length > 10) console.log(`… and ${encounters.length - 10} more.`)
  if (encounters.length) console.log(`\nTotal billed (shown): ${formatCents(total)}`)

  console.log('\nOAuth + pull + canonical mapping all worked. ✅')
  if (!cfg.useMock && encounters.length === 0) {
    console.log('(0 encounters just means the sandbox has no claims on those dates — the connection still works. Try another date.)')
  }
}

main().catch((e) => {
  console.error('\nathena pull FAILED:', e instanceof Error ? e.message : e)
  console.error(
    '\nCheck .env.local has: ATHENA_USE_MOCK=false, ALLOW_REAL_PHI=true, ATHENA_CLIENT_ID, ATHENA_CLIENT_SECRET,\n' +
      'ATHENA_PRACTICE_ID=195900, ATHENA_BASE_URL=https://api.preview.platform.athenahealth.com',
  )
  process.exit(1)
})
