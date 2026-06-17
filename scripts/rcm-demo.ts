/**
 * CLI for the Rung 1 in-house RCM cycle (mock clearinghouse, synthetic data).
 *
 *   npm run rcm-demo
 *
 * Shows the submit -> adjudicate -> post -> work-denials loop a practice would
 * run instead of paying a billing company a percentage of revenue.
 */
import { runRcmCycle } from '../lib/rcm/run'
import { formatCents } from '../lib/canonical'

function main(): void {
  const { totals, claims, findings, edi837 } = runRcmCycle()
  const rule = '  ' + '─'.repeat(66)

  console.log('')
  console.log('  PracticeCompanion — In-House RCM Cycle (Rung 1 · mock clearinghouse)')
  console.log(rule)
  console.log('  837 generated and submitted (first segments):')
  for (const seg of edi837.split('~').slice(0, 5)) {
    if (seg.trim()) console.log('    ' + seg + '~')
  }
  console.log('    …')
  console.log('')
  console.log('  Claim lifecycle')
  console.log(rule)
  for (const c of claims) {
    const tail =
      c.status === 'rejected'
        ? `rejected: ${c.rejectReason}`
        : `paid ${formatCents(c.paidCents)} of ${formatCents(c.billedCents)}`
    console.log(
      `  ${c.claimControlNumber.padEnd(12)} ${(c.payerClaimControlNumber ?? '—').padEnd(10)} ` +
        `${c.status.toUpperCase().padEnd(15)} ${tail}`,
    )
  }
  console.log('')
  console.log(
    `  submitted ${totals.submitted}  ·  accepted ${totals.accepted}  ·  rejected ${totals.rejected}  ·  ` +
      `paid ${totals.paid}  ·  partial ${totals.partiallyPaid}  ·  denied ${totals.denied}`,
  )
  console.log(
    `  billed ${formatCents(totals.billedCents)}  ·  paid ${formatCents(totals.paidCents)}  ·  ` +
      `recovery worklist ${formatCents(totals.recoverableCents)} (${findings.length} findings)`,
  )
  console.log('')
}

main()
