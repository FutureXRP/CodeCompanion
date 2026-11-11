/**
 * Backfill history from Tebra into Neon: walks posting-date windows of
 * ≤ TEBRA_MAX_WINDOW_DAYS (default 60) from the start date to the end date,
 * syncing each one idempotently (re-running replaces, never duplicates).
 *
 *   npm run tebra-backfill -- 2025-11-01 2026-11-11
 *
 * Live pulls pace themselves (1 call/s); a year is ~7 windows. Run it after
 * hours — Tebra asks (guide §3.4) — and keep ALLOW_REAL_PHI on the practice
 * machine only.
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { formatCents } from '../lib/canonical'
import { createTebraSource, dateWindows, fallbackRatesFromEnv, tebraConfigFromEnv } from '../lib/adapters/tebra'
import { closePool, withService, withTenant } from '../lib/db/sql'
import { resolveSyncTenant } from '../lib/db/tenant'
import { syncTebraWindow } from '../lib/sync/tebra'
import { printSummary } from './tebra-sync'

async function main(): Promise<void> {
  const from = process.argv[2]
  const to = process.argv[3] || new Date().toISOString().slice(0, 10)
  if (!from) throw new Error('Usage: npm run tebra-backfill -- <from YYYY-MM-DD> [to YYYY-MM-DD]')
  const cfg = tebraConfigFromEnv()
  const windowDays = cfg.maxWindowDays ?? 60
  const windows = dateWindows(from, to, windowDays)

  console.log('Tebra backfill')
  console.log(`  mode:    ${cfg.useMock ? 'MOCK (synthetic)' : 'LIVE client'}`)
  console.log(`  range:   posted ${from} .. ${to} in ${windows.length} window(s) of ≤ ${windowDays} days`)
  const tenantId = await withService((db) => resolveSyncTenant(db))
  console.log(`  tenant:  ${tenantId}\n`)

  const source = createTebraSource(cfg)
  const rates = fallbackRatesFromEnv()
  let recoverable = 0
  let encounters = 0
  for (const [wFrom, wTo] of windows) {
    const summary = await withTenant(tenantId, (db) =>
      syncTebraWindow({ source, db, tenantId, query: { postingDateFrom: wFrom, postingDateTo: wTo }, fallbackRates: rates, live: cfg.useMock === false }),
    )
    printSummary(summary)
    recoverable += summary.recoverableCents
    encounters += summary.encounters
  }
  await closePool()
  console.log(`\nBackfill complete: ${encounters} encounters · ${formatCents(recoverable)} recoverable across ${windows.length} window(s). ✅`)
}

main().catch(async (e) => {
  console.error('\nTebra backfill FAILED:', e instanceof Error ? e.message : e)
  await closePool().catch(() => undefined)
  process.exit(1)
})
