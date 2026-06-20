import Link from 'next/link'
import { formatCents } from '@/lib/canonical'
import { buildTaskQueue, type TaskPriority, type TaskStatus } from '@/lib/tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const RED = '#cf5547'
const BLUE = '#3f7d6a' // sage primary

const PRIORITY: Record<TaskPriority, { fg: string; bg: string }> = {
  high: { fg: RED, bg: '#fff5f5' }, medium: { fg: AMBER, bg: '#fdf4e3' }, low: { fg: SUB, bg: '#f1f3f7' },
}
const STATUS_LABEL: Record<TaskStatus, string> = { open: 'Open', in_progress: 'In progress', done: 'Done' }
const STATUS_STYLE: Record<TaskStatus, { fg: string; bg: string }> = {
  open: { fg: BLUE, bg: '#eef2fb' }, in_progress: { fg: AMBER, bg: '#fdf4e3' }, done: { fg: GREEN, bg: '#e8f6ee' },
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: '15px 17px' }}>
      <p style={{ fontSize: 11, color: FAINT, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? INK, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: SUB, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function TasksPage() {
  const q = buildTaskQueue()
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: FAINT, padding: '8px 14px', borderBottom: `1px solid ${LINE}`, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12.5, color: INK, padding: '10px 14px', borderBottom: `1px solid #f3f5f9`, verticalAlign: 'middle' }

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1180, margin: '0 auto' }}>
      <style>{`.pc-row:hover { background: #fafbfd; }`}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 26 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: 0, letterSpacing: '-0.025em' }}>Follow-up Queue</h1>
            <span style={{ fontSize: 11, fontWeight: 600, color: GREEN, background: '#e8f6ee', padding: '3px 10px', borderRadius: 999 }}>Synthetic</span>
          </div>
          <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>Every open revenue task — owned, prioritized, and aging against its SLA. Nothing falls through.</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: FAINT, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>At stake</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatCents(q.dollarsAtStakeCents)}</p>
          <p style={{ fontSize: 11.5, color: SUB, margin: '3px 0 0' }}>across {q.counts.open + q.counts.inProgress} active tasks</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 26 }}>
        <Kpi label="Open" value={String(q.counts.open)} sub={`${q.counts.inProgress} in progress`} />
        <Kpi label="Overdue" value={String(q.counts.overdue)} accent={q.counts.overdue > 0 ? RED : GREEN} sub="past SLA" />
        <Kpi label="Done" value={String(q.counts.done)} accent={GREEN} sub={`${q.counts.total} total`} />
        <Kpi label="At stake" value={formatCents(q.dollarsAtStakeCents)} accent={AMBER} sub="recoverable / collectible" />
      </div>

      {/* By assignee */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, q.byAssignee.length)}, 1fr)`, gap: 12, marginBottom: 26 }}>
        {q.byAssignee.map((a) => (
          <div key={a.assignee} style={{ ...card, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: '0 0 6px' }}>{a.assignee}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{a.openCount}</span>
              <span style={{ fontSize: 12, color: SUB }}>active · {formatCents(a.dollarsCents)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Task table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Priority</th><th style={th}>Task</th><th style={th}>Owner</th><th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>$</th><th style={{ ...th, textAlign: 'right' }}>Due</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {q.tasks.map((t) => {
                const p = PRIORITY[t.priority]
                const s = STATUS_STYLE[t.status]
                return (
                  <tr key={t.id} className="pc-row">
                    <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, color: p.fg, background: p.bg, padding: '2px 9px', borderRadius: 999, textTransform: 'capitalize' }}>{t.priority}</span></td>
                    <td style={td}>
                      <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{t.title}</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{t.detail}</p>
                    </td>
                    <td style={{ ...td, color: SUB, whiteSpace: 'nowrap' }}>{t.assignee}</td>
                    <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, color: s.fg, background: s.bg, padding: '2px 9px', borderRadius: 999 }}>{STATUS_LABEL[t.status]}</span></td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCents(t.dollarsCents)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: t.overdue ? RED : SUB, fontWeight: t.overdue ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                      {t.status === 'done' ? '—' : t.overdue ? `${Math.abs(t.dueInDays)}d over` : `in ${t.dueInDays}d`}
                    </td>
                    <td style={td}><Link href={t.href} style={{ fontSize: 12, color: BLUE, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Work →</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: FAINT, marginTop: 18, lineHeight: 1.5 }}>
        Tasks are generated deterministically from the engine&apos;s open work (appealable denials, unpaid claims, patient balances); priority and dollars are engine-derived. Ownership and status are seeded for the demo — a real build persists assignment, status, and SLAs to the database.
      </p>
    </div>
  )
}
