import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import type { VisitStatus } from '@/lib/canonical'
import { createTebraSource, tebraConfigFromEnv } from '@/lib/adapters/tebra'
import { runTebraFrontDesk, type TebraFrontDesk, type FrontDeskSeverity } from '@/lib/capture'
import { DEFAULT_DATE } from '@/lib/mock-ehr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Front Desk — today's schedule with what to catch before each patient is in
 * the room: coverage ended, no insurance on a billable case, authorization
 * expired or used up, the copay and balance to collect. Read from the PM's own
 * records; deterministic.
 */

const SEVERITY_BADGE: Record<FrontDeskSeverity, { label: string; variant: 'red' | 'amber' | 'green' }> = {
  blocker: { label: 'fix before visit', variant: 'red' },
  warning: { label: 'check', variant: 'amber' },
  info: { label: 'collect', variant: 'green' },
}
const STATUS_LABEL: Record<VisitStatus, string> = {
  scheduled: 'Scheduled', confirmed: 'Confirmed', checked_in: 'Checked in', roomed: 'Roomed', checked_out: 'Checked out',
  no_show: 'No-show', cancelled: 'Cancelled', rescheduled: 'Rescheduled', unknown: '—',
}
const mono: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 12 }
const timeOf = (iso?: string) => {
  const m = iso ? /T(\d{2}):(\d{2})/.exec(iso) : null
  if (!m) return '—'
  const h = Number(m[1])
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'am' : 'pm'}`
}

export default async function FrontDeskPage() {
  const cfg = tebraConfigFromEnv()
  const date = cfg.useMock ? DEFAULT_DATE : new Date().toISOString().slice(0, 10)
  let result: TebraFrontDesk | null = null
  let error: string | null = null
  try {
    result = await runTebraFrontDesk(createTebraSource(cfg), { from: date, to: date })
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const report = result?.report

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Front Desk · {date}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 760, lineHeight: 1.5 }}>
            Today&apos;s visits with what to catch before each patient is in the room — coverage that ended, no insurance on a billable case, an
            authorization that expired or is used up, and the copay and balance to collect. Read from the PM&apos;s own records.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.useMock ? '#2f8a5b' : '#b8862a', background: cfg.useMock ? '#e6f4ec' : '#f6efdd', padding: '4px 10px', borderRadius: 999, marginTop: 4 }}>
          {cfg.useMock ? 'Tebra · mock · synthetic' : 'Tebra · live'}
        </span>
      </div>

      {error ? (
        <div style={{ padding: '14px 16px', fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 12, lineHeight: 1.55 }}>
          Schedule unavailable: {error}
        </div>
      ) : report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, margin: '0 0 18px' }}>
            <StatCard label="Visits" value={String(report.totals.expected)} delta={`${report.totals.visits - report.totals.expected} cancelled / moved`} />
            <StatCard label="Ready" value={String(report.totals.ready)} delta="nothing to catch" />
            <StatCard label="Fix before visit" value={String(report.totals.blockers)} delta={`${report.totals.warnings} to check`} accent={report.totals.blockers > 0 ? 'warning' : 'default'} />
            <StatCard label="Copays to collect" value={formatCents(report.totals.copaysCents)} delta="at check-in" />
            <StatCard label="Balances to collect" value={formatCents(report.totals.balancesCents)} delta={`${formatCents(report.totals.collectCents)} total to ask for`} accent={report.totals.balancesCents > 0 ? 'warning' : 'default'} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {report.reviews.map(({ visit, flags, collectCents, ready }) => {
              const dim = visit.status === 'cancelled' || visit.status === 'rescheduled' || visit.status === 'no_show'
              const primary = visit.coverage.find((c) => c.sequence === 'P') ?? visit.coverage[0]
              return (
                <div key={visit.id} style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden', opacity: dim ? 0.55 : 1 }}>
                  <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: flags.length && !dim ? '1px solid #f0ece3' : 'none' }}>
                    <span style={{ ...mono, color: '#1f2d27', fontWeight: 600, minWidth: 64 }}>{timeOf(visit.start)}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1f2d27' }}>{visit.patientName}</span>
                    <span style={{ fontSize: 12.5, color: '#6b7280' }}>{[visit.reason, visit.provider].filter(Boolean).join(' · ')}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5a6b62', background: '#f0ece3', padding: '3px 9px', borderRadius: 999 }}>{STATUS_LABEL[visit.status]}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {primary ? `${primary.payer.name}${primary.planName ? ` · ${primary.planName}` : ''}` : visit.payerScenario ?? 'no coverage'}
                        {visit.coverage.length > 1 ? ` (+${visit.coverage.length - 1} secondary)` : ''}
                      </span>
                      {!dim && (collectCents > 0 ? <strong style={{ fontSize: 13, color: '#2f8a5b' }}>collect {formatCents(collectCents)}</strong> : null)}
                      {!dim && <Badge label={ready ? 'ready' : flags.some((f) => f.severity === 'blocker') ? 'fix before visit' : 'check'} variant={ready ? 'green' : flags.some((f) => f.severity === 'blocker') ? 'red' : 'amber'} />}
                    </span>
                  </div>
                  {!dim && flags.map((f) => {
                    const sb = SEVERITY_BADGE[f.severity]
                    return (
                      <div key={f.id} style={{ padding: '9px 16px', borderBottom: '1px solid #f6f3ec', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, paddingTop: 1 }}><Badge label={sb.label} variant={sb.variant} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2d27' }}>{f.title}</div>
                          <div style={{ fontSize: 12.5, color: '#4b5b52', lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
                        </div>
                        {f.amountCents ? <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#2f8a5b', fontVariantNumeric: 'tabular-nums' }}>{formatCents(f.amountCents)}</div> : null}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {report.reviews.length === 0 && (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#9aa69f', background: '#fff', border: '1px solid #ece7dd', borderRadius: 12 }}>No visits on the schedule for {date}.</div>
            )}
          </div>

          <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
            From the PM&apos;s schedule and the policies / authorizations it holds (<code>lib/capture/frontdesk.ts</code>). Real-time eligibility is the PM&apos;s own
            270/271 check — this page tells the desk when what is on file is not enough. Collect amounts are the copay on the policy plus the open balance.
          </p>
        </>
      )}
    </div>
  )
}
