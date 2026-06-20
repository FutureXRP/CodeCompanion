import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { aggregate, MIN_SAMPLE_N } from '@/lib/corpus'
import { sampleObservations } from '@/lib/corpus/sample'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa69f',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #ece7dd',
}
const td: React.CSSProperties = {
  fontSize: 13, color: '#3a4640', padding: '11px 12px', borderBottom: '1px solid #f0ece3', verticalAlign: 'top',
}
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function CorpusPage() {
  const { rows, suppressed, observations } = aggregate(sampleObservations())

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Behavioral Corpus</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 740, lineHeight: 1.5 }}>
          The moat: how each payer <em>actually</em> behaves per code and region, learned across every practice — allowed, paid,
          days-to-pay, denial rate. It is what trains Rung 2 (predictive adjudication). Built by a one-way de-identification
          transform: payer behavior in, never a patient.
        </p>
      </div>

      <div style={{ background: '#e6f4ec', border: '1px solid #bfe6cf', borderRadius: 12, padding: '13px 16px', margin: '16px 0 20px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2f8a5b', marginBottom: 4 }}>De-identified · no PHI · no patient or tenant id</div>
        <div style={{ fontSize: 12.5, color: '#33614a', lineHeight: 1.6 }}>
          Rows carry only aggregate statistics keyed by payer, region, specialty, and code — structurally incapable of holding a
          person. Cells with fewer than {MIN_SAMPLE_N} observations are suppressed so no single patient&apos;s behavior is inferable.
          The de-id gate runs on every row before it is stored, and again at the database write boundary.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '0 0 22px' }}>
        <StatCard label="Behavior cells" value={String(rows.length)} delta="payer × code × region" />
        <StatCard label="Observations" value={String(observations)} delta="adjudicated lines" />
        <StatCard label="Suppressed" value={String(suppressed)} delta={`< ${MIN_SAMPLE_N} samples`} accent={suppressed > 0 ? 'warning' : 'default'} />
        <StatCard label="Tenant ids stored" value="0" delta="by construction" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2d27' }}>Payer behavior</span>
          <span style={{ fontSize: 12, color: '#9aa69f' }}>synthetic aggregates · medians shown</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Payer</th>
              <th style={th}>Region</th>
              <th style={th}>Code</th>
              <th style={th}>Class</th>
              <th style={{ ...th, ...num }}>Allowed (med)</th>
              <th style={{ ...th, ...num }}>Paid (med)</th>
              <th style={{ ...th, ...num }}>Days to pay</th>
              <th style={{ ...th, ...num }}>Denial rate</th>
              <th style={{ ...th, ...num }}>n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{r.payerExternalId}</td>
                <td style={td}>{r.region}</td>
                <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{r.cptHcpcs}</td>
                <td style={{ ...td, textTransform: 'capitalize', color: '#6b7280' }}>{r.contractClass}</td>
                <td style={{ ...td, ...num }}>{formatCents(r.allowedStat.p50)}</td>
                <td style={{ ...td, ...num }}>{formatCents(r.paidStat.p50)}</td>
                <td style={{ ...td, ...num, color: '#6b7280' }}>{r.daysToPayStat ? `${r.daysToPayStat.p50}d` : '—'}</td>
                <td style={{ ...td, ...num }}>
                  <Badge label={`${Math.round(r.denialRate * 100)}%`} variant={r.denialRate >= 0.1 ? 'amber' : 'green'} />
                </td>
                <td style={{ ...td, ...num, color: '#9aa69f' }}>{r.sampleN}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
        Synthetic data. In production this aggregates adjudicated lines across all practices through the de-id transform
        (<code>lib/corpus</code>). The corpus table has no <code>tenant_id</code> and no foreign key to any patient-bearing table; a
        database <code>CHECK</code> enforces the same {MIN_SAMPLE_N}-sample floor. This cross-practice view is what no incumbent has —
        and what Rung 2 underwrites against.
      </p>
    </div>
  )
}
