import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { loadSampleClaims, loadSampleRemittances } from '../lib/adapters/edi'
import { FeeSchedule, parseFeeScheduleCsv } from '../lib/adapters/fee-schedule'
import { preflightFoundMoney } from '../lib/found-money/preflight'
import { runFoundMoneyFrom } from '../lib/found-money/run'
import { summarizeReport, summaryToCsv, summaryToJson } from '../lib/found-money/summary'

const claims = loadSampleClaims()
const remittances = loadSampleRemittances()
const feeLines = parseFeeScheduleCsv(readFileSync(path.join(process.cwd(), 'lib', 'adapters', 'fee-schedule', 'sample_fee_schedule.csv'), 'utf8'))

test('preflight: the sample files line up — joins, rates and payer ids all agree', () => {
  const pre = preflightFoundMoney(claims, remittances, feeLines)
  assert.equal(pre.ok, true)
  assert.equal(pre.clean, true)
  assert.ok(pre.stats.claims > 0 && pre.stats.remittances > 0)
  assert.ok(pre.stats.joinRate >= 0.5, `join rate ${pre.stats.joinRate}`)
  assert.ok(pre.stats.rateCoverage >= 0.8, `rate coverage ${pre.stats.rateCoverage}`)
  assert.ok(pre.stats.payers.some((p) => p.payerId === '00123' && p.claims > 0 && p.rates > 0))
  assert.equal(pre.checks.find((c) => c.id === 'payer_alignment')?.status, 'pass')
  assert.ok(pre.stats.dosFrom && pre.stats.dosTo && pre.stats.dosFrom <= pre.stats.dosTo)
})

test('preflight: a fee schedule keyed by payer NAME instead of the 837 payer id is caught, with the fix', () => {
  const wrong = feeLines.map((f) => ({ ...f, payerExternalId: 'MEDICARE' }))
  const pre = preflightFoundMoney(claims, remittances, wrong)
  assert.equal(pre.ok, false)
  const align = pre.checks.find((c) => c.id === 'payer_alignment')!
  assert.equal(align.status, 'fail')
  assert.match(align.detail, /match no claim: MEDICARE/)
  assert.match(align.detail, /with no rates: 00123/)
  assert.match(align.detail, /as it appears in the 837/)
  assert.equal(pre.checks.find((c) => c.id === 'rate_coverage')?.status, 'fail')
})

test('preflight: missing remittances / rates / claims degrade with a plain explanation', () => {
  const noRemits = preflightFoundMoney(claims, [], feeLines)
  assert.equal(noRemits.ok, true)
  assert.equal(noRemits.clean, false)
  assert.match(noRemits.checks.find((c) => c.id === 'remittances')!.detail, /unanswered/)
  assert.ok(!noRemits.checks.some((c) => c.id === 'join'))

  const noRates = preflightFoundMoney(claims, remittances, [])
  assert.equal(noRates.checks.find((c) => c.id === 'rates')?.status, 'warn')
  assert.match(noRates.checks.find((c) => c.id === 'rates')!.detail, /underpayments cannot/)
  assert.ok(!noRates.checks.some((c) => c.id === 'rate_coverage'))

  const nothing = preflightFoundMoney([], remittances, feeLines)
  assert.equal(nothing.ok, false)
  assert.equal(nothing.checks[0].status, 'fail')
  assert.match(nothing.checks[0].detail, /not an 837/)

  const broken = preflightFoundMoney(claims, remittances.map((r) => ({ ...r, claimControlNumber: `X-${r.claimControlNumber}` })), feeLines)
  assert.equal(broken.checks.find((c) => c.id === 'join')?.status, 'fail')
  assert.match(broken.checks.find((c) => c.id === 'join')!.detail, /CLP01 must equal the 837 claim id/)
})

test('summary: de-identified totals by payer and code — no claim numbers, dates or names', () => {
  const report = runFoundMoneyFrom(claims, remittances, new FeeSchedule(feeLines), 'samples')
  const s = summarizeReport(report, claims, remittances)
  assert.equal(s.totals.findings, report.totals.count)
  assert.equal(s.totals.recoverableCents, report.totals.recoverableCents)
  assert.equal(s.totals.claims, claims.length)
  assert.equal(s.byPayer.reduce((x, p) => x + p.recoverableCents, 0), report.totals.recoverableCents)
  assert.equal(s.byPayerCode.reduce((x, r) => x + r.recoverableCents, 0), report.totals.recoverableCents)
  assert.ok(s.byPayer.every((p, i) => i === 0 || s.byPayer[i - 1].recoverableCents >= p.recoverableCents))

  const json = summaryToJson(s)
  const csv = summaryToCsv(s)
  for (const c of claims) {
    assert.ok(!json.includes(c.controlNumber), `claim number ${c.controlNumber} leaked into the summary`)
    assert.ok(!csv.includes(c.controlNumber))
    if (c.subscriber) {
      assert.ok(!json.includes(c.subscriber.lastName))
      assert.ok(!json.includes(c.subscriber.memberId))
    }
    if (c.dateOfService) assert.ok(!json.includes(c.dateOfService))
  }
  assert.match(csv, /^section,payer_id,payer,cpt,claims,lines,billed,paid,findings,denials,underpayments,unanswered,undercoding,recoverable\n/)
  assert.match(csv, /\ntotals,,,,/)
  assert.match(csv, /\nby_payer,00123,/)
})
