/**
 * Day-one validation of a Tebra account: does the data come back the way the
 * Technical Guide says? Run this on the FIRST live pull, before trusting a dollar.
 *
 *   npm run tebra-validate                         # mock: proves the checks themselves
 *   npm run tebra-validate -- 2026-10-01 2026-10-31   # live: a service-date window
 *
 * Reads TEBRA_* from .env.local (TEBRA-INTEGRATION.md). Exit code 1 on any FAIL.
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { createTebraSource, pullTebraCanonical, pullTebraPending, pullTebraSchedule, tebraConfigFromEnv, validateTebraShape } from '../lib/adapters/tebra'

async function main(): Promise<void> {
  const cfg = tebraConfigFromEnv()
  const today = new Date().toISOString().slice(0, 10)
  const from = process.argv[2] || (cfg.useMock ? today : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
  const to = process.argv[3] || (cfg.useMock ? from : today)

  console.log('Tebra validation')
  console.log(`  mode:     ${cfg.useMock ? 'MOCK (synthetic — validates the checks, not an account)' : 'LIVE client'}`)
  console.log(`  practice: ${cfg.practiceName ?? '(unset)'}`)
  console.log(`  window:   service dates ${from} .. ${to}\n`)

  const source = createTebraSource(cfg)
  const pull = await pullTebraCanonical(source, { serviceDateFrom: from, serviceDateTo: to })
  const pending = await pullTebraPending(source, { serviceDateFrom: from, serviceDateTo: to })
  // The schedule: the last 7 days of the window (one GetPatient per distinct patient, paced).
  const scheduleFrom = new Date(Math.max(new Date(`${from}T00:00:00Z`).getTime(), new Date(`${to}T00:00:00Z`).getTime() - 6 * 86_400_000)).toISOString().slice(0, 10)
  const schedule = await pullTebraSchedule(source, { from: scheduleFrom, to })
  const report = validateTebraShape({ rows: pull.rows, practice: pull.practice, pendingRows: pending.rows, appointments: schedule.appointments, patients: schedule.patients })

  const mark = { pass: '✓', warn: '!', fail: '✗', info: '·' }
  for (const c of report.checks) {
    console.log(`  ${mark[c.status]} ${c.label}`)
    console.log(`      ${c.detail}`)
  }
  console.log('\n' + (report.clean ? 'Everything looks the way the guide says. ✅' : report.ok ? 'Usable, with warnings to work through (see ! above).' : 'FAILED — fix the ✗ items before trusting any figure.'))
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error('\nTebra validation FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
