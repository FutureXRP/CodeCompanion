/**
 * CLI runner for the Rung 0 found-money pipeline.
 *
 *   npm run found-money
 *
 * Runs against the synthetic sample 837/835 + fee schedule by default. Point it
 * at real files (post-COMPLIANCE gate) with:
 *   EDI_USE_SAMPLE_FILES=false ALLOW_REAL_PHI=true \
 *   EDI_837_PATH=... EDI_835_PATH=... FEE_SCHEDULE_PATH=... npm run found-money
 *
 * Run from the repository root (paths resolve from process.cwd()).
 */
import { runFoundMoney } from '../lib/found-money/run'
import { findingsToCsv, reportToJson } from '../lib/found-money/export'
import { formatCents } from '../lib/canonical'

function main(): void {
  const report = runFoundMoney()

  // `--csv` / `--json` emit machine-readable output for piping to a file.
  if (process.argv.includes('--csv')) {
    process.stdout.write(findingsToCsv(report.findings))
    return
  }
  if (process.argv.includes('--json')) {
    process.stdout.write(reportToJson(report))
    return
  }

  const { totals, meta, findings } = report

  const line = '  ' + '─'.repeat(64)
  console.log('')
  console.log('  PracticeCompanion — Found-Money Report (Rung 0)')
  console.log(line)
  console.log(
    `  Source: ${meta.source}   Claims: ${meta.claimCount}   Lines: ${meta.lineCount}   ` +
      `Remits: ${meta.remittanceCount}   Rates: ${meta.feeScheduleSize}`,
  )
  console.log('')
  console.log(`  TOTAL RECOVERABLE:  ${formatCents(totals.recoverableCents)}  (${totals.count} findings)`)
  console.log(`    underpayments         ${formatCents(totals.byType.underpayment.recoverableCents).padStart(12)}  (${totals.byType.underpayment.count})`)
  console.log(`    denials (appealable)  ${formatCents(totals.byType.denial.recoverableCents).padStart(12)}  (${totals.byType.denial.count})`)
  console.log(`    undercoding           ${formatCents(totals.byType.undercoding.recoverableCents).padStart(12)}  (${totals.byType.undercoding.count})`)
  console.log(`    unadjudicated (risk)  ${formatCents(totals.byType.unadjudicated.recoverableCents).padStart(12)}  (${totals.byType.unadjudicated.count})`)
  console.log('')
  console.log('  Ranked findings')
  console.log(line)
  for (const finding of findings) {
    const flag = finding.appealable ? 'appealable' : finding.status
    console.log(
      `  ${formatCents(finding.recoverableCents).padStart(11)}  ${finding.type.padEnd(12)} ` +
        `${finding.cptHcpcs.padEnd(7)} ${finding.payerName.padEnd(10)} [${flag}]`,
    )
    console.log(`               ${finding.reason}`)
  }
  console.log('')
}

main()
