import { isValidNpi } from '../../scrub'
import { isAdjudicated, normalizeStatus, parseAdjustmentReason, tebraCents } from './to-canonical'
import type { TebraChargeRaw, TebraPracticeRaw } from './types'

/**
 * Day-one live validation — does the data the account returns look the way the
 * Technical Guide says? Run against the first real pull (`npm run tebra-validate`)
 * before trusting any dollar figure. Pure: a report over raw rows, so it is unit-
 * tested against the mock and runs unchanged against the live account.
 */

export type ValidationStatus = 'pass' | 'warn' | 'fail' | 'info'

export interface ValidationCheck {
  id: string
  label: string
  status: ValidationStatus
  detail: string
}

export interface ValidationReport {
  checks: ValidationCheck[]
  /** No fails. */
  ok: boolean
  /** No fails and no warns. */
  clean: boolean
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100))

export function validateTebraShape(input: { rows: TebraChargeRaw[]; practice?: TebraPracticeRaw; pendingRows?: TebraChargeRaw[] }): ValidationReport {
  const { rows, practice, pendingRows = [] } = input
  const checks: ValidationCheck[] = []
  const add = (id: string, label: string, status: ValidationStatus, detail: string) => checks.push({ id, label, status, detail })

  // 1. Anything at all
  add('rows', 'Charges returned', rows.length > 0 ? 'pass' : 'fail', rows.length > 0 ? `${rows.length} charge lines` : 'No charges in the window — widen the dates, or nothing has been posted yet.')
  if (rows.length === 0) return finish(checks)

  // 2. The keys every line needs
  const keyed = rows.filter((r) => r.EncounterID?.trim() && r.ProcedureCode?.trim()).length
  add('keys', 'EncounterID + ProcedureCode on every line', keyed === rows.length ? 'pass' : 'fail', `${keyed}/${rows.length} lines carry both — the adapter drops the rest.`)

  // 3. Charges
  const charged = rows.filter((r) => tebraCents(r.TotalCharges) > 0).length
  add('charges', 'TotalCharges populated', pct(charged, rows.length) >= 95 ? 'pass' : 'warn', `${pct(charged, rows.length)}% of lines have a charge.`)

  // 4. Contract rates — the one input Tebra ships empty
  const expected = rows.filter((r) => tebraCents(r.ExpectedAmount) > 0 || tebraCents(r.AllowedAmount) > 0).length
  const expectedPct = pct(expected, rows.length)
  add(
    'contract_rates',
    'ExpectedAmount from Contract Rates',
    expectedPct >= 80 ? 'pass' : expectedPct > 0 ? 'warn' : 'fail',
    expectedPct > 0
      ? `${expectedPct}% of lines have a contract-expected amount${expectedPct < 80 ? ' — load the missing payers’ contract rates (Settings › Contracts and Fees) or underpayment detection stays partial' : ''}.`
      : 'No line has a contract-expected amount — the Contract Rates table is empty; underpayment detection is blind until it is loaded.',
  )

  // 5. Statuses
  const statuses = new Map<string, number>()
  for (const r of rows) statuses.set(r.Status?.trim() || '(blank)', (statuses.get(r.Status?.trim() || '(blank)') ?? 0) + 1)
  const recognized = rows.filter((r) => normalizeStatus(r.Status) !== 'unknown').length
  add('statuses', 'Claim statuses recognized', recognized === rows.length ? 'pass' : 'warn', [...statuses].map(([s, n]) => `${s} ×${n}`).join(', ') + (recognized < rows.length ? ' — unrecognized values map to "unknown"' : ''))

  // 6. Adjudication + reason codes
  const adjudicated = rows.filter(isAdjudicated)
  if (adjudicated.length === 0) {
    add('adjudicated', 'Adjudicated lines', 'warn', 'No line has a posted payment or denial in this window — nothing for the diff to compare yet (ERAs not posted, or the window is too recent).')
  } else {
    add('adjudicated', 'Adjudicated lines', 'pass', `${adjudicated.length}/${rows.length} lines carry a posted payment or denial.`)
    const withAdj = adjudicated.filter((r) => tebraCents(r.PrimaryInsuranceContractAdjustment) !== 0)
    const parseable = withAdj.filter((r) => parseAdjustmentReason(r.PrimaryInsuranceContractAdjustmentReason).carcCode !== 'UNKNOWN').length
    if (withAdj.length > 0) {
      const p = pct(parseable, withAdj.length)
      add('carc', 'Adjustment reasons carry CARC codes', p >= 90 ? 'pass' : 'warn', `${p}% of contract adjustments have a parseable CARC (e.g. CO-45)${p < 90 ? ' — denials without a code land in manual review; check the ERA posting rules keep CARC/RARC' : ''}.`)
    }
    const allowed = adjudicated.filter((r) => tebraCents(r.PrimaryInsuranceAllowed) > 0 || tebraCents(r.PrimaryInsurancePayment) === 0).length
    add('allowed', 'PrimaryInsuranceAllowed populated', pct(allowed, adjudicated.length) >= 90 ? 'pass' : 'warn', `${pct(allowed, adjudicated.length)}% of paid lines report the payer’s allowed amount (else it is derived from billed − contractual).`)
  }

  // 7. Payers
  const payers = new Map<string, number>()
  for (const r of rows) {
    const p = r.PrimaryInsuranceBilledCompanyName?.trim() || '(patient / none)'
    payers.set(p, (payers.get(p) ?? 0) + 1)
  }
  add('payers', 'Payers seen', payers.size > 0 ? 'info' : 'warn', [...payers].map(([p, n]) => `${p} ×${n}`).join(', '))

  // 8. Billing dates for aging
  const sent = rows.filter((r) => !['ready', 'undefined', 'pending'].includes(normalizeStatus(r.Status)))
  if (sent.length > 0) {
    const dated = sent.filter((r) => (r.PrimaryInsuranceLastBillDate ?? r.PrimaryInsuranceFirstBillDate ?? r.PrimaryInsuranceFirstBilDate ?? '').trim()).length
    add('bill_dates', 'Primary bill dates present', pct(dated, sent.length) >= 80 ? 'pass' : 'warn', `${pct(dated, sent.length)}% of sent lines have a first/last bill date (drives timely-filing aging).`)
  }

  // 9. Secondary coverage
  const secondary = rows.filter((r) => r.SecondaryInsuranceBilledCompanyName?.trim()).length
  add('secondary', 'Secondary payers on file', 'info', `${secondary}/${rows.length} lines carry a secondary payer — the crossover rule in the Posting Workbench depends on it.`)

  // 10. Practice
  if (!practice) add('practice', 'GetPractices', 'warn', 'No practice record returned — billing NPI / tax id fall back to the service location; check the API user’s permissions.')
  else add('practice', 'GetPractices', practice.NPI && isValidNpi(practice.NPI) ? 'pass' : 'warn', practice.NPI && isValidNpi(practice.NPI) ? `${practice.PracticeName ?? ''} · NPI ${practice.NPI}` : `Practice NPI "${practice.NPI ?? ''}" fails the check digit.`)

  // 11. Pending (pre-approval) pull
  if (pendingRows.length === 0) add('pending', 'Unapproved encounters', 'info', 'None returned — either nothing is awaiting approval or IncludeUnapprovedCharges is not honored for this user.')
  else {
    const tagged = pendingRows.filter((r) => r.EncounterStatus === 'Draft' || r.EncounterStatus === 'Review').length
    add('pending', 'Unapproved encounters', tagged === pendingRows.length ? 'pass' : 'warn', `${pendingRows.length} charge lines awaiting approval (${pendingRows.filter((r) => r.EncounterStatus === 'Draft').length} Draft, ${pendingRows.filter((r) => r.EncounterStatus === 'Review').length} Review).`)
  }

  return finish(checks)
}

function finish(checks: ValidationCheck[]): ValidationReport {
  const ok = !checks.some((c) => c.status === 'fail')
  const clean = ok && !checks.some((c) => c.status === 'warn')
  return { checks, ok, clean }
}
