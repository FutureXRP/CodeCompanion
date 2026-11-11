/**
 * Pull a service-date window of charges from Tebra, normalize them, run the
 * found-money diff and print the report — proves the SOAP client + canonical
 * mapping + Rung 0 diff work end to end. Synthetic mock by default.
 *
 *   npm run tebra-pull                              # mock: the synthetic clinic day
 *   npm run tebra-pull -- 2026-10-15                # one service date
 *   npm run tebra-pull -- 2026-10-01 2026-10-31     # a range (live pulls are sliced into ≤60-day calls)
 *
 * Reads TEBRA_* from .env.local. For the live client (practice-controlled machine
 * only — see TEBRA-INTEGRATION.md):
 *   TEBRA_USE_MOCK=false, ALLOW_REAL_PHI=true, TEBRA_CUSTOMER_KEY, TEBRA_USER,
 *   TEBRA_PASSWORD, TEBRA_PRACTICE_NAME
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { createTebraSource, tebraConfigFromEnv } from '../lib/adapters/tebra'
import { runTebraFoundMoney } from '../lib/found-money/tebra'
import { formatCents } from '../lib/canonical'

async function main(): Promise<void> {
  const cfg = tebraConfigFromEnv()
  const today = new Date().toISOString().slice(0, 10)
  const from = process.argv[2] || today
  const to = process.argv[3] || from

  console.log('Tebra pull')
  console.log(`  mode:     ${cfg.useMock ? 'MOCK (synthetic, no network)' : 'LIVE client (Web Services API 2.1)'}`)
  console.log(`  practice: ${cfg.practiceName ?? '(unset)'}`)
  console.log(`  dates:    ${from}${to !== from ? ` .. ${to}` : ''}\n`)

  const result = await runTebraFoundMoney(createTebraSource(cfg), { serviceDateFrom: from, serviceDateTo: to })
  const { rows, claims, remittances, feeSchedule, report } = result
  const remitByClaim = new Map(remittances.map((r) => [r.claimControlNumber, r]))

  console.log(`Pulled ${rows.length} charge line(s) → ${claims.length} encounter(s), ${remittances.length} adjudicated, ${feeSchedule.size} contract rate(s).\n`)
  for (const c of claims.slice(0, 15)) {
    const remit = remitByClaim.get(c.controlNumber)
    const expected = c.lines.reduce((s, l) => s + (feeSchedule.rate(c.payer.externalId, l.cptHcpcs, l.modifiers[0]) ?? 0), 0)
    const name = c.subscriber ? `${c.subscriber.firstName} ${c.subscriber.lastName}`.trim() : c.controlNumber
    console.log(`• ${c.dateOfService}  ${c.controlNumber}  ${name}  ${c.payer.name}`)
    console.log(
      `    ${c.lines.map((l) => l.cptHcpcs + (l.modifiers.length ? '-' + l.modifiers.join(',') : '')).join(', ')}   ` +
        `billed ${formatCents(c.totalBilledCents)}  contract ${formatCents(expected)}  paid ${remit ? formatCents(remit.totalPaidCents) : '— (no remit)'}`,
    )
  }
  if (claims.length > 15) console.log(`… and ${claims.length - 15} more.`)

  const { totals } = report
  const line = '  ' + '─'.repeat(64)
  console.log('\n  Found-Money Report (Rung 0) — source: tebra')
  console.log(line)
  console.log(`  TOTAL RECOVERABLE:  ${formatCents(totals.recoverableCents)}  (${totals.count} findings)`)
  console.log(`    underpayments         ${formatCents(totals.byType.underpayment.recoverableCents).padStart(12)}  (${totals.byType.underpayment.count})`)
  console.log(`    denials (appealable)  ${formatCents(totals.byType.denial.recoverableCents).padStart(12)}  (${totals.byType.denial.count})`)
  console.log(`    undercoding           ${formatCents(totals.byType.undercoding.recoverableCents).padStart(12)}  (${totals.byType.undercoding.count})`)
  console.log(`    unadjudicated (risk)  ${formatCents(totals.byType.unadjudicated.recoverableCents).padStart(12)}  (${totals.byType.unadjudicated.count})`)
  console.log(line)
  for (const f of report.findings.slice(0, 20)) {
    console.log(`  ${formatCents(f.recoverableCents).padStart(11)}  ${f.type.padEnd(12)} ${f.cptHcpcs.padEnd(7)} ${f.payerName.padEnd(12)} ${f.reason}`)
  }

  console.log('\nSOAP client + canonical mapping + diff all worked. ✅')
  if (!cfg.useMock && rows.length === 0) {
    console.log('(0 charges just means nothing was posted on those service dates — the connection still works. Try a wider range.)')
  }
}

main().catch((e) => {
  console.error('\nTebra pull FAILED:', e instanceof Error ? e.message : e)
  console.error(
    '\nCheck .env.local has: TEBRA_USE_MOCK=false, ALLOW_REAL_PHI=true, TEBRA_CUSTOMER_KEY, TEBRA_USER,\n' +
      'TEBRA_PASSWORD, TEBRA_PRACTICE_NAME (see TEBRA-INTEGRATION.md).',
  )
  process.exit(1)
})
