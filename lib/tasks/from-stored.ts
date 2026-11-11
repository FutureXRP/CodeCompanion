import type { StoredTask } from '../db/operational-repo'
import type { Task, TaskSource } from './index'

const MS_PER_DAY = 86_400_000
const HREF: Record<TaskSource, string> = { denial: '/workbench', follow_up: '/workbench', balance: '/workbench', review: '/review' }

/** Stored rows → the queue shape: age from creation, SLA from the stored due date. */
export function tasksFromStored(stored: StoredTask[], now: Date): Task[] {
  const days = (iso: string | null) => (iso ? Math.floor((now.getTime() - new Date(`${iso}T00:00:00Z`).getTime()) / MS_PER_DAY) : 0)
  return stored.map((t) => {
    const dueInDays = t.dueDate ? -days(t.dueDate) : 0
    return {
      id: t.id,
      title: t.title,
      detail: t.detail ?? '',
      source: t.source,
      dollarsCents: t.dollarsCents,
      assignee: t.assignee ?? 'Unassigned',
      status: t.status,
      priority: t.priority,
      ageDays: Math.max(0, days(t.createdAt)),
      dueInDays,
      overdue: dueInDays < 0 && t.status !== 'done',
      href: HREF[t.source] ?? '/workbench',
    }
  })
}
