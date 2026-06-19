import type { Cents } from '../canonical'
import { runDiff } from '../diff'
import { scrubClaim, OKLAHOMA } from '../scrub'
import { pullClaims, adjudicate, mockEhrRates } from '../mock-ehr'
import { buildLedger, type AccountStanding } from '../ledger'
import { deriveClaimState } from './lifecycle'
import { buildWorklist, type WorkItem } from './worklist'
import type { SubmissionAck } from './clearinghouse'

/**
 * The Revenue Cycle Command Center — the office manager's single pane of glass.
 *
 * This does NOT introduce new logic; it runs the existing deterministic engine
 * (pull → scrub → submit → adjudicate → diff → worklist → ledger) once over the
 * synthetic clinic day and rolls it up into the whole revenue cycle as stages,
 * a prioritized worklist, and the patient balances. Every dollar is engine
 * output — no figure is invented here (CLAUDE.md). When real claims/remits flow
 * (post-BAA), the same shape is fed by the real adapters; nothing above changes.
 */

export type StageTone = 'neutral' | 'good' | 'warn' | 'bad'

export interface CycleStage {
  key: string
  label: string
  href: string
  /** Items currently sitting at this stage. */
  count: number
  /** Dollars associated with the stage (omitted when a count is the point). */
  amountCents?: Cents
  amountLabel: string
  tone: StageTone
  hint: string
}

export interface CommandWorkItem extends WorkItem {
  patientName?: string
}

export interface CommandBalance {
  accountKey: string
  patientName?: string
  payerName?: string
  patientArCents: Cents
  standing: AccountStanding
}

export interface CommandKpis {
  billedCents: Cents
  /** Insurance dollars posted. */
  collectedCents: Cents
  /** Outstanding from payers. */
  insuranceArCents: Cents
  /** Outstanding from patients — the statement balance. */
  patientArCents: Cents
  /** Found-money leakage still recoverable (underpayments + denials + undercoding). */
  recoverableCents: Cents
  /** Recoverable + patient A/R — the money still on the table to capture. */
  captureOpportunityCents: Cents
  /** Submitted claims accepted on first pass (no rework). 0..1. */
  cleanClaimRate: number
}

export interface CommandCenter {
  asOf: string
  kpis: CommandKpis
  stages: CycleStage[]
  worklist: CommandWorkItem[]
  balances: CommandBalance[]
  counts: { patients: number; claims: number; denials: number; scrubFails: number }
  meta: { source: 'mock-ehr'; generatedAt: string }
}

const tone = (n: number, bad: StageTone = 'warn'): StageTone => (n > 0 ? bad : 'good')

/** Run the full cycle over the synthetic clinic day and roll it into the cockpit view. */
export function buildCommandCenter(worklistLimit = 6, balanceLimit = 5): CommandCenter {
  const claims = pullClaims()
  const rates = mockEhrRates()
  const remittances = adjudicate(claims, rates)
  const findings = runDiff(claims, remittances, rates)

  const remitByCn = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  const nameByCn = new Map(
    claims.map((c) => [c.controlNumber, c.subscriber ? `${c.subscriber.firstName} ${c.subscriber.lastName}` : undefined]),
  )

  // No real clearinghouse in the synthetic day: every claim is accepted, and the
  // payer's ICN comes back on the remittance (what a 277CA + 835 would carry).
  const acks: SubmissionAck[] = claims.map((c) => ({
    claimControlNumber: c.controlNumber,
    status: 'accepted',
    payerClaimControlNumber: remitByCn.get(c.controlNumber)?.payerClaimControlNumber,
  }))
  const ackByCn = new Map(acks.map((a) => [a.claimControlNumber, a]))

  const states = claims.map((c) => deriveClaimState(c, ackByCn.get(c.controlNumber), remitByCn.get(c.controlNumber)))
  const worklist = buildWorklist({ claims, acks, remittances, findings })
  const ledger = buildLedger({ claims, remittances })
  const scrubFails = claims.filter((c) => !scrubClaim(c, OKLAHOMA).ok)

  // Roll-ups.
  const billedCents = states.reduce((s, x) => s + x.billedCents, 0)
  const collectedCents = states.reduce((s, x) => s + x.paidCents, 0)
  const sumBilled = (cns: Set<string>) => states.filter((s) => cns.has(s.claimControlNumber)).reduce((s, x) => s + x.billedCents, 0)
  const sumFindings = (pred: (t: string) => boolean) =>
    findings.filter((f) => pred(f.type)).reduce((s, f) => s + f.recoverableCents, 0)

  const denialCount = findings.filter((f) => f.type === 'denial').length
  const denialCents = sumFindings((t) => t === 'denial')
  const foundCount = findings.filter((f) => f.type === 'underpayment' || f.type === 'undercoding').length
  const foundCents = sumFindings((t) => t === 'underpayment' || t === 'undercoding')
  const unadjudicated = states.filter((s) => s.status === 'submitted')
  const rejected = states.filter((s) => s.status === 'rejected')
  const patientAccounts = ledger.accounts.filter((a) => a.balance.patientArCents > 0)
  const recoverableCents = findings.reduce((s, f) => s + f.recoverableCents, 0)

  const kpis: CommandKpis = {
    billedCents,
    collectedCents,
    insuranceArCents: ledger.totals.insuranceArCents,
    patientArCents: ledger.totals.patientArCents,
    recoverableCents,
    captureOpportunityCents: recoverableCents + ledger.totals.patientArCents,
    cleanClaimRate: states.length === 0 ? 1 : (states.length - rejected.length) / states.length,
  }

  const stages: CycleStage[] = [
    {
      key: 'eligibility', label: 'Verify eligibility', href: '/eligibility',
      count: claims.length, amountLabel: 'patients today', tone: 'neutral',
      hint: 'Confirm coverage & benefits before the visit (270/271).',
    },
    {
      key: 'charges', label: 'Capture charges', href: '/coding',
      count: claims.length, amountCents: billedCents, amountLabel: 'billed', tone: 'neutral',
      hint: 'Encounters coded and charges built from the EHR.',
    },
    {
      key: 'scrub', label: 'Scrub', href: '/scrub',
      count: scrubFails.length, amountCents: sumBilled(new Set(scrubFails.map((c) => c.controlNumber))),
      amountLabel: 'at risk', tone: tone(scrubFails.length), hint: 'Pre-submission edits to clear before claims go out.',
    },
    {
      key: 'submit', label: 'Submit & track', href: '/claims',
      count: states.length, amountCents: billedCents, amountLabel: 'submitted', tone: 'neutral',
      hint: 'Sent to payers and tracked to adjudication.',
    },
    {
      key: 'rejections', label: 'Rejections', href: '/claims',
      count: rejected.length, amountCents: sumBilled(new Set(rejected.map((s) => s.claimControlNumber))),
      amountLabel: 'to rework', tone: tone(rejected.length, 'bad'), hint: 'Pre-adjudication rejections — fix & resubmit as new.',
    },
    {
      key: 'awaiting', label: 'Awaiting payer', href: '/claims',
      count: unadjudicated.length, amountCents: ledger.totals.insuranceArCents, amountLabel: 'in A/R', tone: 'neutral',
      hint: 'Submitted, not yet adjudicated — follow up before timely-filing.',
    },
    {
      key: 'denials', label: 'Denials & appeals', href: '/claims',
      count: denialCount, amountCents: denialCents, amountLabel: 'appealable', tone: tone(denialCount, 'bad'),
      hint: 'Adjudicated denials — appeal or correct & replace.',
    },
    {
      key: 'found', label: 'Found money', href: '/found-money',
      count: foundCount, amountCents: foundCents, amountLabel: 'recoverable', tone: tone(foundCount),
      hint: 'Underpayments & undercoding vs the contracted rate.',
    },
    {
      key: 'balances', label: 'Patient balances', href: '/ledger',
      count: patientAccounts.length, amountCents: ledger.totals.patientArCents, amountLabel: 'to collect',
      tone: tone(patientAccounts.length), hint: 'Statements and patient-pay collections.',
    },
    {
      key: 'collected', label: 'Collected', href: '/analytics',
      count: states.filter((s) => s.status === 'paid').length, amountCents: collectedCents, amountLabel: 'posted',
      tone: 'good', hint: 'Payments posted and reconciled to the ledger.',
    },
  ]

  const balances: CommandBalance[] = patientAccounts.slice(0, balanceLimit).map((a) => ({
    accountKey: a.accountKey,
    patientName: a.patientName,
    payerName: a.payerName,
    patientArCents: a.balance.patientArCents,
    standing: a.standing,
  }))

  return {
    asOf: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    kpis,
    stages,
    worklist: worklist.slice(0, worklistLimit).map((w) => ({ ...w, patientName: nameByCn.get(w.claimControlNumber) })),
    balances,
    counts: { patients: claims.length, claims: claims.length, denials: denialCount, scrubFails: scrubFails.length },
    meta: { source: 'mock-ehr', generatedAt: new Date().toISOString() },
  }
}
