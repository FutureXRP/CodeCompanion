import type { Claim, ClaimTracking, Finding } from '../canonical'
import { formatCents } from '../canonical'
import type { RateLookup } from '../diff'
import type { PaymentRegression } from './regressions'

/**
 * The posting workbench — the "claims that need a biller's attention" queue,
 * computed deterministically from what the practice-management system already
 * tracks (ClaimTracking) plus the found-money findings. It decides what to
 * chase and what it is worth; it never posts anything. (Tebra sells this view
 * as the workbench half of its ERA bot; CodeCompanion derives it from the pull.)
 *
 * DETERMINISTIC. Every amount is a contract rate, a billed charge, a finding's
 * recoverable figure or a posted balance — never an estimate, never an LLM.
 */

export type WorkbenchCategory =
  | 'appeal_denial'
  | 'appeal_underpayment'
  | 'recoupment'
  | 'resubmit_rejected'
  | 'status_check'
  | 'bill_secondary'
  | 'send_statement'

export interface WorkbenchItem {
  /** Deterministic id: `${category}:${claimLineId}`. */
  id: string
  category: WorkbenchCategory
  claimControlNumber: string
  claimLineId: string
  patientName: string
  payerName: string
  cptHcpcs: string
  dateOfService?: string
  /** Money at stake — to recover, bill, or collect. */
  amountCents: number
  /** Days since the line was last billed (or since the service date). */
  daysSince?: number
  /** Deterministic, template-generated instruction. NEVER LLM-generated. */
  action: string
  /** The finding this item came from, when it did (links to the appeal flow). */
  findingId?: string
}

export interface CategoryTotal {
  count: number
  amountCents: number
}

export interface PostingWorkbench {
  items: WorkbenchItem[]
  atStakeCents: number
  byCategory: Record<WorkbenchCategory, CategoryTotal>
}

export const WORKBENCH_CATEGORIES: WorkbenchCategory[] = [
  'appeal_denial',
  'appeal_underpayment',
  'recoupment',
  'resubmit_rejected',
  'status_check',
  'bill_secondary',
  'send_statement',
]

export const WORKBENCH_LABELS: Record<WorkbenchCategory, string> = {
  appeal_denial: 'Appeal denial',
  appeal_underpayment: 'Appeal underpayment',
  recoupment: 'Recoupment / takeback',
  resubmit_rejected: 'Fix & resubmit',
  status_check: 'Check claim status',
  bill_secondary: 'Bill secondary',
  send_statement: 'Send statement',
}

/** A sent-and-accepted line older than this with no answer gets a status check. */
export const PENDING_FOLLOW_UP_DAYS = 30
const MS_PER_DAY = 86_400_000

export interface WorkbenchInput {
  claims: Claim[]
  findings: Finding[]
  tracking: ClaimTracking[]
  rates: RateLookup
  /** Payments that went down since the last sync (lib/found-money/regressions). */
  regressions?: PaymentRegression[]
}

export function buildPostingWorkbench(input: WorkbenchInput, now: Date = new Date()): PostingWorkbench {
  const claimsByControl = new Map(input.claims.map((c) => [c.controlNumber, c]))
  const trackedLines = new Set(input.tracking.map((t) => t.claimLineId))
  const items: WorkbenchItem[] = []

  // 1. Findings that need a biller: appeals. Unanswered lines come from the
  //    tracking below when the PM reports them; otherwise (the file path) from the diff.
  for (const f of input.findings) {
    const claim = claimsByControl.get(f.claimControlNumber)
    if (f.type === 'denial' && f.appealable) {
      items.push(fromFinding(f, claim, 'appeal_denial', `Appeal — ${f.reason}`, now))
    } else if (f.type === 'underpayment') {
      items.push(fromFinding(f, claim, 'appeal_underpayment', `Reprice or appeal — ${f.reason}`, now))
    } else if (f.type === 'unadjudicated' && !trackedLines.has(f.claimLineId)) {
      items.push(fromFinding(f, claim, 'status_check', `Check claim status — ${f.reason}`, now))
    }
  }

  // 2. What the PM's claim tracking says about every line that has been sent.
  //    Draft / Review encounters belong to the pre-approval review, not here.
  for (const t of input.tracking) {
    if (t.status === 'draft' || t.status === 'review') continue
    const claim = claimsByControl.get(t.claimControlNumber)
    const line = claim?.lines.find((l) => l.id === t.claimLineId)
    if (!claim || !line) continue
    const contracted = input.rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0]) ?? line.billedCents
    const daysSince = daysBetween(t.lastBilledDate ?? claim.dateOfService, now)
    const base = {
      claimControlNumber: claim.controlNumber,
      claimLineId: line.id,
      patientName: patientName(claim),
      payerName: claim.payer.name,
      cptHcpcs: line.cptHcpcs,
      dateOfService: claim.dateOfService,
      daysSince,
    }

    if (t.status === 'rejected') {
      items.push({
        ...base,
        id: `resubmit_rejected:${line.id}`,
        category: 'resubmit_rejected',
        amountCents: contracted,
        action: `Rejected before adjudication${aged(daysSince, 'since sent')} — fix the error and resubmit; nothing is owed until the payer accepts it. ${formatCents(contracted)} on the line.`,
      })
    } else if (t.status === 'no_response' || (t.status === 'pending' && daysSince !== undefined && daysSince > PENDING_FOLLOW_UP_DAYS)) {
      items.push({
        ...base,
        id: `status_check:${line.id}`,
        category: 'status_check',
        amountCents: contracted,
        action: `No payer response${aged(daysSince, 'since sent')} — check claim status; resend if the payer never received it. ${formatCents(contracted)} on the line.`,
      })
    }

    if (t.status === 'adjudicated' && t.patientBalanceCents > 0) {
      if (t.secondaryPayer && !t.secondaryBilledDate) {
        items.push({
          ...base,
          id: `bill_secondary:${line.id}`,
          category: 'bill_secondary',
          amountCents: t.patientBalanceCents,
          action: `Bill ${t.secondaryPayer.name} — the primary left ${formatCents(t.patientBalanceCents)} that the secondary should cover before the patient is billed.`,
        })
      } else if (!t.secondaryPayer && !t.patientBilledDate) {
        items.push({
          ...base,
          id: `send_statement:${line.id}`,
          category: 'send_statement',
          amountCents: t.patientBalanceCents,
          action: `Patient owes ${formatCents(t.patientBalanceCents)} after insurance and has never been sent a statement.`,
        })
      }
    }
  }

  // 3. Money the payer took back since the last sync.
  for (const g of input.regressions ?? []) {
    const claim = claimsByControl.get(g.claimControlNumber)
    const line = g.cptHcpcs ? claim?.lines.find((l) => l.cptHcpcs === g.cptHcpcs && l.modifiers.join(',') === (g.modifiers ?? []).join(',')) : undefined
    const lineId = line?.id ?? `${g.claimControlNumber}:claim`
    items.push({
      id: `recoupment:${lineId}`,
      category: 'recoupment',
      claimControlNumber: g.claimControlNumber,
      claimLineId: lineId,
      patientName: claim ? patientName(claim) : g.claimControlNumber,
      payerName: claim?.payer.name ?? '',
      cptHcpcs: g.cptHcpcs ?? (claim?.lines.map((l) => l.cptHcpcs).join(', ') ?? ''),
      dateOfService: claim?.dateOfService,
      daysSince: daysBetween(claim?.dateOfService, now),
      amountCents: -g.deltaCents,
      action: `Payer took back ${formatCents(-g.deltaCents)} since the last sync (paid ${formatCents(g.previousPaidCents)} → ${formatCents(g.currentPaidCents)}) — find the reason on the remittance (duplicate, COB, audit, offset) and rebill or appeal.`,
    })
  }

  items.sort((a, b) => b.amountCents - a.amountCents || a.category.localeCompare(b.category) || a.id.localeCompare(b.id))

  const byCategory = Object.fromEntries(WORKBENCH_CATEGORIES.map((c) => [c, { count: 0, amountCents: 0 }])) as Record<WorkbenchCategory, CategoryTotal>
  let atStakeCents = 0
  for (const item of items) {
    byCategory[item.category].count += 1
    byCategory[item.category].amountCents += item.amountCents
    atStakeCents += item.amountCents
  }
  return { items, atStakeCents, byCategory }
}

function fromFinding(f: Finding, claim: Claim | undefined, category: WorkbenchCategory, action: string, now: Date): WorkbenchItem {
  return {
    id: `${category}:${f.claimLineId}`,
    category,
    claimControlNumber: f.claimControlNumber,
    claimLineId: f.claimLineId,
    patientName: claim ? patientName(claim) : f.claimControlNumber,
    payerName: f.payerName,
    cptHcpcs: f.cptHcpcs,
    dateOfService: f.dateOfService,
    amountCents: f.recoverableCents,
    daysSince: daysBetween(f.dateOfService, now),
    action,
    findingId: f.id,
  }
}

function patientName(claim: Claim): string {
  const s = claim.subscriber
  const name = s ? `${s.firstName} ${s.lastName}`.trim() : ''
  return name || claim.controlNumber
}

function daysBetween(iso: string | undefined, now: Date): number | undefined {
  if (!iso) return undefined
  const then = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime()
  if (Number.isNaN(then)) return undefined
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY))
}

function aged(days: number | undefined, suffix: string): string {
  return days === undefined ? '' : ` (${days} days ${suffix})`
}
