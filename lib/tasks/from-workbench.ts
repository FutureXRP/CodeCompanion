import { formatCents } from '../canonical'
import type { CaptureReport } from '../capture/types'
import { WORKBENCH_LABELS, type PostingWorkbench, type WorkbenchCategory } from '../found-money/workbench'
import { SLA_DAYS, priorityFor, type Task, type TaskPriority, type TaskSource } from './index'

/**
 * Engine output → persistable tasks. Each task carries a stable `sourceKey`
 * (the workbench item id, or `review:<encounter>`) so a nightly sync upserts it:
 * the engine refreshes title / detail / dollars / priority, a human's assignee,
 * status and due date survive, and items that stop applying are closed.
 *
 * PHI minimization: the detail carries the claim control number and the payer,
 * not the patient's name — the Workbench / Review pages show names live.
 */

export interface PersistableTask extends Task {
  sourceKey: string
}

const SOURCE_FOR: Record<WorkbenchCategory, TaskSource> = {
  appeal_denial: 'denial',
  appeal_underpayment: 'denial',
  recoupment: 'follow_up',
  resubmit_rejected: 'follow_up',
  status_check: 'follow_up',
  bill_secondary: 'balance',
  send_statement: 'balance',
}

export const DEFAULT_OWNERS: Record<TaskSource, string> = { denial: 'A/R', follow_up: 'Billing', balance: 'Front desk', review: 'Billing' }

export type Owners = Partial<Record<TaskSource, string>>

export function tasksFromWorkbench(wb: PostingWorkbench, owners: Owners = {}): PersistableTask[] {
  return wb.items.map((item) => {
    const source = SOURCE_FOR[item.category]
    const priority = priorityFor(item.amountCents)
    return {
      id: item.id,
      sourceKey: item.id,
      title: `${WORKBENCH_LABELS[item.category]} · ${item.cptHcpcs}${item.payerName ? ` · ${item.payerName}` : ''}`,
      detail: `${item.claimControlNumber}${item.dateOfService ? ` · DOS ${item.dateOfService}` : ''} — ${item.action}`,
      source,
      dollarsCents: item.amountCents,
      assignee: owners[source] ?? DEFAULT_OWNERS[source],
      status: 'open',
      priority,
      ageDays: item.daysSince ?? 0,
      dueInDays: SLA_DAYS[priority],
      overdue: false,
      href: '/workbench',
    }
  })
}

/** One task per encounter that must be fixed before approval (blocked / fix); opportunities-only encounters are not tasks. */
export function tasksFromReview(report: CaptureReport, owners: Owners = {}): PersistableTask[] {
  return report.reviews
    .filter((r) => r.verdict === 'blocked' || r.verdict === 'fix')
    .map((r) => {
      const dollars = r.atRiskCents + r.opportunityCents
      const priority: TaskPriority = r.verdict === 'blocked' ? 'high' : priorityFor(dollars)
      const top = r.findings.filter((f) => f.severity !== 'opportunity').slice(0, 3).map((f) => f.title).join('; ')
      const money = [r.atRiskCents ? `${formatCents(r.atRiskCents)} at risk` : '', r.opportunityCents ? `${formatCents(r.opportunityCents)} if documented` : ''].filter(Boolean).join(', ')
      return {
        id: `review:${r.claimControlNumber}`,
        sourceKey: `review:${r.claimControlNumber}`,
        title: `${r.verdict === 'blocked' ? 'Will reject — fix before approving' : 'Fix before approving'} · ${r.claimControlNumber}`,
        detail: `${top}${money ? ` — ${money}` : ''}`,
        source: 'review',
        dollarsCents: dollars,
        assignee: owners.review ?? DEFAULT_OWNERS.review,
        status: 'open',
        priority,
        ageDays: 0,
        dueInDays: SLA_DAYS[priority],
        overdue: false,
        href: '/review',
      }
    })
}
