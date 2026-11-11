import type { Cents } from '../canonical'
import { classifyCarc } from '../diff/carc'
import { sampleArBook, ageInDays } from '../analytics'

/**
 * The follow-up queue — every open revenue task, owned, prioritized, and aging.
 *
 * Turns the engine's open work (appealable denials, unpaid claims to chase,
 * patient balances to collect) into assignable tasks with an owner, an SLA, and
 * an overdue flag, so nothing falls through. DETERMINISTIC: priority and dollars
 * come from the engine; assignment/status are seeded for the demo (a real build
 * persists these to the DB). No LLM produces a figure or a routing decision.
 */

/** denial / follow_up / balance come from the posting side; review from the pre-approval side. */
export type TaskSource = 'denial' | 'follow_up' | 'balance' | 'review'
export type TaskStatus = 'open' | 'in_progress' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  detail: string
  source: TaskSource
  dollarsCents: Cents
  assignee: string
  status: TaskStatus
  priority: TaskPriority
  /** Age of the underlying receivable/denial in days. */
  ageDays: number
  /** Days until the SLA due date (negative = overdue). */
  dueInDays: number
  overdue: boolean
  href: string
}

export interface AssigneeLoad {
  assignee: string
  openCount: number
  dollarsCents: Cents
}

export interface TaskQueue {
  tasks: Task[]
  counts: { total: number; open: number; inProgress: number; done: number; overdue: number }
  /** Dollars on tasks that are not yet done. */
  dollarsAtStakeCents: Cents
  byAssignee: AssigneeLoad[]
}

const OWNER = { ar: 'Priya — A/R', billing: 'Dana — Billing', front: 'Marco — Front desk' }
export const SLA_DAYS: Record<TaskPriority, number> = { high: 7, medium: 14, low: 30 }

export const priorityFor = (cents: Cents): TaskPriority => (cents >= 15_000 ? 'high' : cents >= 6_000 ? 'medium' : 'low')

/** Counts, dollars at stake and per-owner load for any task list (synthetic or stored). */
export function queueFromTasks(tasks: Task[]): TaskQueue {
  const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
  const sorted = [...tasks].sort((a, b) => Number(b.overdue) - Number(a.overdue) || rank[a.priority] - rank[b.priority] || b.dollarsCents - a.dollarsCents)
  const open = sorted.filter((t) => t.status === 'open').length
  const inProgress = sorted.filter((t) => t.status === 'in_progress').length
  const done = sorted.filter((t) => t.status === 'done').length
  const overdue = sorted.filter((t) => t.overdue).length
  const dollarsAtStakeCents = sorted.filter((t) => t.status !== 'done').reduce((s, t) => s + t.dollarsCents, 0)
  const loads = new Map<string, AssigneeLoad>()
  for (const t of sorted) {
    if (t.status === 'done') continue
    const load = loads.get(t.assignee) ?? { assignee: t.assignee, openCount: 0, dollarsCents: 0 }
    load.openCount += 1
    load.dollarsCents += t.dollarsCents
    loads.set(t.assignee, load)
  }
  return {
    tasks: sorted,
    counts: { total: sorted.length, open, inProgress, done, overdue },
    dollarsAtStakeCents,
    byAssignee: [...loads.values()].sort((a, b) => b.dollarsCents - a.dollarsCents),
  }
}

/** Stable hash so status is varied but reproducible regardless of ordering. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function statusFor(id: string): TaskStatus {
  const h = hash(id)
  return h % 7 === 0 ? 'done' : h % 5 === 0 ? 'in_progress' : 'open'
}

export function buildTaskQueue(asOf: Date = new Date()): TaskQueue {
  const book = sampleArBook(asOf)
  const tasks: Task[] = []

  const make = (partial: Omit<Task, 'status' | 'priority' | 'dueInDays' | 'overdue' | 'ageDays'>): Task => {
    const status = statusFor(partial.id)
    const priority = priorityFor(partial.dollarsCents)
    // Task age = days the task has been OPEN (deterministic), not the receivable's
    // age — a fresh task on an old claim isn't overdue. SLA is measured from here.
    const ageDays = hash(`age-${partial.id}`) % 13
    const dueInDays = SLA_DAYS[priority] - ageDays
    return { ...partial, ageDays, status, priority, dueInDays, overdue: dueInDays < 0 && status !== 'done' }
  }

  // Appealable denials → appeal tasks (top by dollars).
  book.denials
    .filter((d) => classifyCarc(d.carcCode).appealable)
    .sort((a, b) => b.deniedCents - a.deniedCents)
    .slice(0, 15)
    .forEach((d) =>
      tasks.push(make({
        id: `denial-${d.claimControlNumber}`,
        title: `Appeal denial — CARC ${d.carcCode}`,
        detail: `${d.payerName} · ${classifyCarc(d.carcCode).description}`,
        source: 'denial',
        dollarsCents: d.deniedCents,
        assignee: OWNER.ar,
        href: '/aging',
      })),
    )

  // Aged unpaid insurance claims → follow-up-with-payer tasks.
  book.receivables
    .filter((r) => r.insuranceArCents > 0 && ageInDays(r.dateOfService, asOf) >= 45)
    .sort((a, b) => b.insuranceArCents - a.insuranceArCents)
    .slice(0, 12)
    .forEach((r) => {
      const age = ageInDays(r.dateOfService, asOf)
      tasks.push(make({
        id: `followup-${r.claimControlNumber}`,
        title: 'Follow up unpaid claim',
        detail: `${r.payerName} · ${age}d outstanding`,
        source: 'follow_up',
        dollarsCents: r.insuranceArCents,
        assignee: OWNER.billing,
        href: '/aging',
      }))
    })

  // Patient balances → collect / statement tasks.
  book.receivables
    .filter((r) => r.patientArCents > 0 && ageInDays(r.dateOfService, asOf) >= 21)
    .sort((a, b) => b.patientArCents - a.patientArCents)
    .slice(0, 12)
    .forEach((r) =>
      tasks.push(make({
        id: `balance-${r.claimControlNumber}`,
        title: 'Collect patient balance',
        detail: `${r.patientName ?? 'Patient'} · ${r.payerName}`,
        source: 'balance',
        dollarsCents: r.patientArCents,
        assignee: OWNER.front,
        href: '/billing',
      })),
    )

  // Overdue first, then priority, then dollars.
  return queueFromTasks(tasks)
}

export * from './from-workbench'
export * from './from-stored'
