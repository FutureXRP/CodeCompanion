/**
 * Run the Tebra sync once, by hand — the same code the nightly job runs.
 *
 *   npm run tebra-sync                                 # the nightly window (last 3 days modified)
 *   npm run tebra-sync -- 2026-10-01 2026-10-31        # a posting-date window
 *
 * Needs DATABASE_URL and a tenant (SYNC_TENANT_ID, or the only tenant). Mock
 * unless TEBRA_USE_MOCK=false (+ ALLOW_REAL_PHI=true + credentials).
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { formatCents } from '../lib/canonical'
import { createTebraSource, fallbackRatesFromEnv, tebraConfigFromEnv } from '../lib/adapters/tebra'
import { closePool, withService, withTenant } from '../lib/db/sql'
import { resolveSyncTenant } from '../lib/db/tenant'
import { nightlyWindow, syncTebraWindow, type TebraSyncSummary } from '../lib/sync/tebra'

export function printSummary(s: TebraSyncSummary): void {
  const w = s.query
  const label = w.postingDateFrom && !w.modifiedDateFrom ? `posted ${w.postingDateFrom}..${w.postingDateTo}` : w.modifiedDateFrom ? `modified ${w.modifiedDateFrom}..${w.modifiedDateTo}` : `service ${w.serviceDateFrom}..${w.serviceDateTo}`
  console.log(`  ${label}: ${s.rows} lines · ${s.encounters} encounters (${s.adjudicated} adjudicated) · ${s.contractRates} rates`)
  console.log(`    found money ${formatCents(s.recoverableCents)} (${s.findings}) · workbench ${s.workbench.items.length} items / ${formatCents(s.workbench.atStakeCents)} · takebacks ${s.regressions.length}`)
  console.log(`    stored: ${s.persisted.claims} claims, ${s.persisted.remittances} remits, ${s.persisted.findings} findings (${s.persisted.replaced} replaced)`)
}

async function main(): Promise<void> {
  const cfg = tebraConfigFromEnv()
  const now = new Date()
  const query = process.argv[2] ? { postingDateFrom: process.argv[2], postingDateTo: process.argv[3] || process.argv[2] } : nightlyWindow(now)

  console.log('Tebra sync')
  console.log(`  mode:   ${cfg.useMock ? 'MOCK (synthetic)' : 'LIVE client'}`)
  const tenantId = await withService((db) => resolveSyncTenant(db))
  console.log(`  tenant: ${tenantId}`)
  const source = createTebraSource(cfg)
  const summary = await withTenant(tenantId, (db) =>
    syncTebraWindow({ source, db, tenantId, query, fallbackRates: fallbackRatesFromEnv(), live: cfg.useMock === false, now }),
  )
  printSummary(summary)
  await closePool()
  console.log('\nSync complete. ✅')
}

if (process.argv[1] && /tebra-sync\.ts$/.test(process.argv[1])) {
  main().catch(async (e) => {
    console.error('\nTebra sync FAILED:', e instanceof Error ? e.message : e)
    await closePool().catch(() => undefined)
    process.exit(1)
  })
}
