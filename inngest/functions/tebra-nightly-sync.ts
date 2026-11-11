import { inngest } from '../client'
import { runNightlyTebraSync } from '@/lib/sync/tebra'

/**
 * Nightly Tebra sync — after hours, as Tebra asks (guide §3.3/3.4): one pull of
 * everything modified in the last few days, diffed, takebacks detected, stored
 * idempotently. Off unless TEBRA_SYNC_ENABLED=true; the real client stays
 * behind ALLOW_REAL_PHI like everywhere else.
 */
export const tebraNightlySync = inngest.createFunction(
  { id: 'tebra-nightly-sync', name: 'Tebra nightly sync' },
  { cron: process.env.TEBRA_SYNC_CRON || '0 7 * * *' }, // 07:00 UTC ≈ 1–2am Central
  async ({ step }) => {
    const outcome = await step.run('sync-window', () => runNightlyTebraSync())
    if ('skipped' in outcome) return outcome
    // Counts only — no patient data in the job log.
    return {
      tenantId: outcome.tenantId,
      window: outcome.query,
      rows: outcome.rows,
      encounters: outcome.encounters,
      findings: outcome.findings,
      recoverableCents: outcome.recoverableCents,
      regressions: outcome.regressions.length,
      workbenchItems: outcome.workbench.items.length,
      replaced: outcome.persisted.replaced,
    }
  },
)
