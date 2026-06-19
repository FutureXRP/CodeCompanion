/**
 * End-to-end integration test on a synthetic clinic-day: pull 15 patients from the
 * mock EHR (FHIR → canonical) and run them through the entire pipeline.
 *   npm run ehr-day
 */
import type { Claim } from '../lib/canonical'
import { formatCents } from '../lib/canonical'
import { pullClaims, adjudicate, mockEhrRates, MOCK_EHR_REGION, MOCK_EHR_SPECIALTY } from '../lib/mock-ehr'
import { scrubClaim, OKLAHOMA } from '../lib/scrub'
import { generate837 } from '../lib/adapters/edi'
import { MockClearinghouse } from '../lib/rcm/clearinghouse'
import { buildWorklist } from '../lib/rcm/worklist'
import { buildLedger } from '../lib/ledger'
import { runDiff } from '../lib/diff'
import { buildCorpus } from '../lib/corpus'

function groupByPayer(claims: Claim[]): Claim[][] {
  const m = new Map<string, Claim[]>()
  for (const c of claims) {
    const g = m.get(c.payer.externalId)
    if (g) g.push(c)
    else m.set(c.payer.externalId, [c])
  }
  return [...m.values()]
}

async function main(): Promise<void> {
  const claims = pullClaims()
  const rates = mockEhrRates()
  console.log(`\n1. PULL — ${claims.length} encounters from the mock EHR (FHIR R4 → fhir adapter → canonical).`)

  // 2. Scrub
  const scrubs = claims.map((c) => ({ c, r: scrubClaim(c, OKLAHOMA) }))
  const blocked = scrubs.filter((s) => !s.r.ok).length
  const warned = scrubs.filter((s) => s.r.ok && s.r.warningCount > 0).length
  console.log(`\n2. SCRUB — ${claims.length - warned - blocked} clean, ${warned} warnings, ${blocked} blocked.`)
  for (const s of scrubs) for (const f of s.r.findings.filter((f) => f.severity !== 'info')) console.log(`     ${s.c.controlNumber} ${f.severity.toUpperCase()} ${f.code} ${f.cptHcpcs ?? ''} — ${f.message}`)

  // 3. Submit (one 837 per payer → clearinghouse)
  const ch = new MockClearinghouse(rates)
  const groups = groupByPayer(claims)
  const acks = []
  for (const g of groups) acks.push(...(await ch.submit(generate837(g, { submitterId: 'SQUAREONE' }))))
  console.log(`\n3. SUBMIT — ${acks.length} claims in ${groups.length} payer batches; ${acks.filter((a) => a.status === 'accepted').length} accepted (277CA).`)

  // 4. Adjudicate (mock payers → 835)
  const remits = adjudicate(claims, rates)

  // 5. Ledger
  const ledger = buildLedger({ claims, remittances: remits })
  console.log(`\n4. LEDGER — charged ${formatCents(ledger.totals.chargedCents)} · insurance paid ${formatCents(ledger.totals.insurancePaidCents)} · write-offs ${formatCents(ledger.totals.contractualAdjCents)} · patient balance ${formatCents(ledger.totals.patientArCents)} across ${ledger.accounts.length} accounts.`)

  // 6. Diff + worklist
  const findings = runDiff(claims, remits, rates)
  const worklist = buildWorklist({ claims, acks, remittances: remits, findings })
  const recoverable = findings.reduce((s, f) => s + f.recoverableCents, 0)
  console.log(`\n5. FOUND MONEY — ${findings.length} findings, ${formatCents(recoverable)} recoverable · worklist ${worklist.length} items:`)
  for (const w of worklist) console.log(`     ${w.claimControlNumber} ${w.cptHcpcs ?? ''} ${w.kind} → ${w.action} ${w.recoverableCents > 0 ? formatCents(w.recoverableCents) : ''}`)

  // 7. Corpus
  const corpus = buildCorpus(claims, remits, { region: MOCK_EHR_REGION, specialty: MOCK_EHR_SPECIALTY })
  console.log(`\n6. CORPUS — ${corpus.observations} observations → ${corpus.rows.length} published, ${corpus.suppressed} suppressed (one day is below the de-id floor — suppression holds).\n`)
}

main()
