import { formatCents } from '@/lib/canonical'
import { buildScheduleSweep, sampleSchedule } from '@/lib/rcm/eligibility-sweep'
import { MockEligibilityService } from '@/lib/rcm/eligibility'

const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const RED = '#cf5547'

const STATUS: Record<string, { fg: string; bg: string; label: string }> = {
  active: { fg: GREEN, bg: '#e8f6ee', label: 'Active' },
  inactive: { fg: RED, bg: '#fff5f5', label: 'Inactive' },
  unknown: { fg: AMBER, bg: '#fdf4e3', label: 'Unknown' },
}

/**
 * Async server component: runs an eligibility check on every appointment in the
 * (synthetic) schedule and renders the pre-visit verification board. In
 * production this is a Stedi batch run overnight; here it uses the mock service.
 */
export async function ScheduleSweep() {
  const sweep = await buildScheduleSweep(sampleSchedule(), new MockEligibilityService())

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: FAINT, padding: '8px 14px', borderBottom: `1px solid ${LINE}`, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12.5, color: INK, padding: '9px 14px', borderBottom: `1px solid #f3f5f9`, verticalAlign: 'middle' }

  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '13px 18px', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>
          {sweep.counts.total} appointments · <span style={{ color: GREEN }}>{sweep.counts.active} active</span>
          {sweep.counts.issues > 0 && <span style={{ color: RED }}> · {sweep.counts.issues} need attention</span>}
        </span>
        <span style={{ fontSize: 12.5, color: SUB }}>≈ {formatCents(sweep.estimatedCopayCents)} copays to collect</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Time</th><th style={th}>Patient</th><th style={th}>Payer</th><th style={th}>Coverage</th>
              <th style={{ ...th, textAlign: 'right' }}>Copay</th><th style={{ ...th, textAlign: 'right' }}>Deductible left</th><th style={th}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {sweep.items.map((item, i) => {
              const s = STATUS[item.status] ?? STATUS.unknown
              return (
                <tr key={i}>
                  <td style={{ ...td, color: SUB, whiteSpace: 'nowrap' }}>{item.appointment.time}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{item.appointment.patientName}</td>
                  <td style={{ ...td, color: SUB }}>{item.appointment.payerName}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: s.fg, background: s.bg, padding: '2px 9px', borderRadius: 999 }}>{s.label}</span></td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.copayCents != null ? formatCents(item.copayCents) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: item.deductibleRemainingCents ? AMBER : FAINT, fontVariantNumeric: 'tabular-nums' }}>{item.deductibleRemainingCents != null ? formatCents(item.deductibleRemainingCents) : '—'}</td>
                  <td style={{ ...td, color: SUB }}>
                    {item.flags.length === 0 ? <span style={{ color: GREEN }}>✓ clear</span> : item.flags.map((f, j) => {
                      const danger = /inactive|unverified/i.test(f)
                      return <span key={j} style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 600, color: danger ? RED : AMBER, background: danger ? '#fff5f5' : '#fdf4e3', padding: '1px 7px', borderRadius: 999, marginRight: 5, marginBottom: 3 }}>{f}</span>
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
