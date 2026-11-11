/**
 * Preflight + run for the file path (837 + 835 + fee schedule) — the way to get
 * the practice's real found-money number from athena history, today, with no
 * cloud and no vendor in the loop.
 *
 *   npm run found-money:check                                   # the synthetic sample files
 *   npm run found-money:check -- --837=claims.edi --835=remits.edi --fees=rates.csv
 *   npm run found-money:check -- ... --summary=found-money-summary.csv   # de-identified totals to share
 *
 * Real files require EDI_USE_SAMPLE_FILES=false and ALLOW_REAL_PHI=true in the
 * environment, exactly like `npm run found-money` — set them on a practice-
 * controlled, encrypted machine only; never in the hosted app (COMPLIANCE.md).
 * The preflight prints counts, codes and payer ids — never a patient.
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { formatCents } from '../lib/canonical'
import { loadClaims, loadRemittances } from '../lib/adapters/edi'
import { FeeSchedule, parseFeeScheduleCsv } from '../lib/adapters/fee-schedule'
import { preflightFoundMoney } from '../lib/found-money/preflight'
import { runFoundMoneyFrom } from '../lib/found-money/run'
import { summarizeReport, summaryToCsv, summaryToJson } from '../lib/found-money/summary'

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

function main(): void {
  const f837 = arg('837')
  const f835 = arg('835')
  const fees = arg('fees')
  if (f837 || f835 || fees) {
    if (!f837 || !f835) throw new Error('Pass both --837=<file> and --835=<file> (and --fees=<csv> for contract rates).')
    process.env.EDI_USE_SAMPLE_FILES = 'false'
    process.env.EDI_837_PATH = f837
    process.env.EDI_835_PATH = f835
    if (fees) process.env.FEE_SCHEDULE_PATH = fees
    if (process.env.ALLOW_REAL_PHI !== 'true') {
      throw new Error('Real claim files are PHI. Run on a practice-controlled machine with ALLOW_REAL_PHI=true (and never set that in the hosted app).')
    }
  }
  const sample = process.env.EDI_USE_SAMPLE_FILES !== 'false'
  const feePath = sample ? path.join(process.cwd(), 'lib', 'adapters', 'fee-schedule', 'sample_fee_schedule.csv') : process.env.FEE_SCHEDULE_PATH

  console.log('Found money — file preflight')
  console.log(`  mode:   ${sample ? 'SAMPLE files (synthetic)' : 'REAL files'}`)
  console.log(`  837:    ${sample ? 'lib/adapters/edi/samples/claim_837_sample.edi' : process.env.EDI_837_PATH}`)
  console.log(`  835:    ${sample ? 'lib/adapters/edi/samples/remit_835_sample.edi' : process.env.EDI_835_PATH}`)
  console.log(`  rates:  ${feePath ?? '(none)'}\n`)

  const claims = loadClaims()
  const remittances = loadRemittances()
  const feeLines = feePath ? parseFeeScheduleCsv(readFileSync(feePath, 'utf8')) : []
  const pre = preflightFoundMoney(claims, remittances, feeLines)

  const mark = { pass: '✓', warn: '!', fail: '✗', info: '·' }
  for (const c of pre.checks) {
    console.log(`  ${mark[c.status]} ${c.label}`)
    console.log(`      ${c.detail}`)
  }
  if (!pre.ok) {
    console.log('\nFAILED — fix the ✗ items; the numbers would be meaningless until then.')
    process.exit(1)
  }

  const report = runFoundMoneyFrom(claims, remittances, new FeeSchedule(feeLines), sample ? 'samples' : 'files')
  const t = report.totals
  console.log('\n  ' + '─'.repeat(64))
  console.log(`  TOTAL RECOVERABLE:  ${formatCents(t.recoverableCents)}  (${t.count} findings on ${claims.length} claims, ${formatCents(pre.stats.billedCents)} billed)`)
  console.log(`    underpayments         ${formatCents(t.byType.underpayment.recoverableCents).padStart(12)}  (${t.byType.underpayment.count})`)
  console.log(`    denials (appealable)  ${formatCents(t.byType.denial.recoverableCents).padStart(12)}  (${t.byType.denial.count})`)
  console.log(`    undercoding           ${formatCents(t.byType.undercoding.recoverableCents).padStart(12)}  (${t.byType.undercoding.count})`)
  console.log(`    unadjudicated (risk)  ${formatCents(t.byType.unadjudicated.recoverableCents).padStart(12)}  (${t.byType.unadjudicated.count})`)
  console.log('  ' + '─'.repeat(64))
  if (!pre.clean) console.log('  (see the ! items above — the figure is usable but partial until they are fixed)')

  const out = arg('summary')
  if (out) {
    const summary = summarizeReport(report, claims, remittances)
    writeFileSync(out, out.endsWith('.json') ? summaryToJson(summary) : summaryToCsv(summary))
    console.log(`\n  De-identified summary written to ${path.resolve(out)} — totals by payer and code, no claim numbers, dates or names.`)
  }
  console.log(`\nFor the line-by-line worklist: npm run found-money -- --csv > worklist.csv  (that file contains claim numbers — keep it inside the practice).`)
}

try {
  main()
} catch (e) {
  console.error('\nPreflight FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
}
