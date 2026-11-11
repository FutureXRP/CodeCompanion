import type { FeeScheduleLine } from '../canonical'
import type { TebraChargeQuery, TebraSource } from '../adapters/tebra'
import { createTebraSource, fallbackRatesFromEnv, tebraConfigFromEnv } from '../adapters/tebra'
import { isNeonConfigured } from '../db/config'
import { writeAudit } from '../db/audit'
import { loadPaidByControl, replaceRun, type PersistResult } from '../db/repository'
import { withService, withTenant, type Queryable } from '../db/sql'
import { resolveSyncTenant } from '../db/tenant'
import { detectPaymentRegressions, type PaymentRegression } from '../found-money/regressions'
import { runTebraFoundMoney } from '../found-money/tebra'
import { buildPostingWorkbench, type PostingWorkbench } from '../found-money/workbench'

/**
 * The Tebra sync: pull a window → diff → detect takebacks against what we
 * stored last time → REPLACE the stored run (idempotent) → audit. One function
 * for the nightly job, the backfill runner and the manual script.
 */

const MS_PER_DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
export const daysBefore = (d: Date, days: number) => new Date(d.getTime() - days * MS_PER_DAY)

export interface TebraSyncOptions {
  source: TebraSource
  /** A tenant-scoped connection (inside withTenant) — the replace + insert run in that transaction. */
  db: Queryable
  tenantId: string
  query: TebraChargeQuery
  fallbackRates?: FeeScheduleLine[]
  /** True when the source is the real API — the PHI read is audited. */
  live: boolean
  userId?: string | null
  now?: Date
}

export interface TebraSyncSummary {
  tenantId: string
  query: TebraChargeQuery
  live: boolean
  rows: number
  encounters: number
  adjudicated: number
  contractRates: number
  findings: number
  recoverableCents: number
  regressions: PaymentRegression[]
  workbench: PostingWorkbench
  persisted: PersistResult & { replaced: number }
  generatedAt: string
}

export async function syncTebraWindow(opts: TebraSyncOptions): Promise<TebraSyncSummary> {
  const now = opts.now ?? new Date()
  const result = await runTebraFoundMoney(opts.source, opts.query, opts.fallbackRates ?? [], now)
  const { claims, remittances, feeSchedule, report, tracking } = result

  if (opts.live) {
    await writeAudit(opts.db, opts.tenantId, opts.userId ?? null, {
      action: 'read',
      resource: 'tebra_charges',
      detail: { rows: result.rows.length, encounters: claims.length, window: opts.query },
    })
  }

  // What did we store last time? A paid amount that went down is a takeback.
  const previous = await loadPaidByControl(opts.db, opts.tenantId, claims.map((c) => c.controlNumber))
  const regressions = detectPaymentRegressions(previous, remittances)

  const persisted = await replaceRun(opts.db, opts.tenantId, { claims, remittances, findings: report.findings })
  const workbench = buildPostingWorkbench({ claims, findings: report.findings, tracking, rates: feeSchedule, regressions }, now)

  return {
    tenantId: opts.tenantId,
    query: opts.query,
    live: opts.live,
    rows: result.rows.length,
    encounters: claims.length,
    adjudicated: remittances.length,
    contractRates: feeSchedule.size,
    findings: report.totals.count,
    recoverableCents: report.totals.recoverableCents,
    regressions,
    workbench,
    persisted,
    generatedAt: now.toISOString(),
  }
}

/**
 * The nightly window: everything modified in the last `lookbackDays` (new
 * payments land on old claims), bounded by a posting window Tebra accepts
 * (it scopes GetCharges by posting date; the community-observed cap is 60 days).
 */
export function nightlyWindow(now: Date, lookbackDays = 3, postingDays = 60): TebraChargeQuery {
  return {
    modifiedDateFrom: iso(daysBefore(now, lookbackDays)),
    modifiedDateTo: iso(now),
    postingDateFrom: iso(daysBefore(now, postingDays - 1)), // inclusive: exactly `postingDays` days → one API call
    postingDateTo: iso(now),
  }
}

export type NightlyOutcome = TebraSyncSummary | { skipped: string }

/** The scheduled job body: env-gated, tenant resolved without a user, one transaction. */
export async function runNightlyTebraSync(now: Date = new Date(), env: Record<string, string | undefined> = process.env): Promise<NightlyOutcome> {
  if (env.TEBRA_SYNC_ENABLED !== 'true') return { skipped: 'TEBRA_SYNC_ENABLED is not true' }
  if (!isNeonConfigured()) return { skipped: 'DATABASE_URL is not set' }
  const cfg = tebraConfigFromEnv()
  const source = createTebraSource(cfg) // throws if live without the PHI gate / credentials
  const lookback = Number(env.TEBRA_SYNC_LOOKBACK_DAYS) > 0 ? Number(env.TEBRA_SYNC_LOOKBACK_DAYS) : 3
  const query = nightlyWindow(now, lookback)
  const tenantId = await withService((db) => resolveSyncTenant(db, env))
  return withTenant(tenantId, (db) =>
    syncTebraWindow({ source, db, tenantId, query, fallbackRates: fallbackRatesFromEnv(env), live: cfg.useMock === false, now }),
  )
}
