import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents, type Finding, type FindingType } from '@/lib/canonical'
import { runFoundMoney, type FoundMoneyReport } from '@/lib/found-money/run'

// Reads sample files and runs the diff server-side; never prerendered/edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPE_BADGE: Record<FindingType, { label: string; variant: 'blue' | 'red' | 'amber' }> = {
  underpayment: { label: 'Underpayment', variant: 'blue' },
  denial: { label: 'Denial', variant: 'red' },
  undercoding: { label: 'Undercoding', variant: 'amber' },
}

function statusBadge(finding: Finding) {
  if (finding.appealable) return <Badge label="Appealable" variant="green" />
  if (finding.type === 'undercoding') return <Badge label="Chart review" variant="purple" />
  if (finding.status === 'terminal') return <Badge label="Terminal" variant="gray" />
  return <Badge label="Open" variant="gray" />
}

const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: '#9aa3b2',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '8px 12px',
  borderBottom: '1px solid #e4e8ef',
}
const td: React.CSSProperties = {
  fontSize: '13px',
  color: '#333d4d',
  padding: '11px 12px',
  borderBottom: '1px solid #f1f3f7',
  verticalAlign: 'top',
}

export default function FoundMoneyPage() {
  let report: FoundMoneyReport | null = null
  let error: string | null = null
  try {
    report = runFoundMoney()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (!report) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Found Money
        </h1>
        <div style={{ marginTop: 16, background: '#fff5f5', border: '1px solid #ffe0e0', borderRadius: 12, padding: '14px 18px', color: '#c9302c', fontSize: 13 }}>
          Could not generate the report: {error}
        </div>
      </div>
    )
  }

  const { totals, meta, findings } = report

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Found Money
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            Deterministic diff of what you billed (837) vs. what was paid (835) vs. your contracted rate.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>
            Total recoverable
          </p>
          <p style={{ fontSize: '30px', fontWeight: 700, color: '#1a7a45', margin: 0, letterSpacing: '-0.02em' }}>
            {formatCents(totals.recoverableCents)}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '18px 0 22px' }}>
        <StatCard label="Total recoverable" value={formatCents(totals.recoverableCents)} delta={`${totals.count} findings`} />
        <StatCard label="Underpayments" value={formatCents(totals.byType.underpayment.recoverableCents)} delta={`${totals.byType.underpayment.count} lines`} />
        <StatCard label="Appealable denials" value={formatCents(totals.byType.denial.recoverableCents)} delta={`${totals.appealableDenialCount} claims`} accent="danger" />
        <StatCard label="Undercoding" value={formatCents(totals.byType.undercoding.recoverableCents)} delta={`${totals.byType.undercoding.count} flags`} accent="warning" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e2533' }}>Ranked findings</span>
          <span style={{ fontSize: '12px', color: '#9aa3b2' }}>by recoverable dollars</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'right' }}>Recoverable</th>
              <th style={th}>Type</th>
              <th style={th}>CPT</th>
              <th style={th}>Payer</th>
              <th style={th}>DOS</th>
              <th style={th}>Status</th>
              <th style={th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: finding.recoverableCents > 0 ? '#1a7a45' : '#9aa3b2', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCents(finding.recoverableCents)}
                </td>
                <td style={td}><Badge label={TYPE_BADGE[finding.type].label} variant={TYPE_BADGE[finding.type].variant} /></td>
                <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  {finding.cptHcpcs}{finding.modifiers.length ? `-${finding.modifiers.join('-')}` : ''}
                </td>
                <td style={td}>{finding.payerName}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280' }}>{finding.dateOfService ?? '—'}</td>
                <td style={td}>{statusBadge(finding)}</td>
                <td style={{ ...td, color: '#4a5366', maxWidth: 360 }}>{finding.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '12px', color: '#9aa3b2', marginTop: 14, lineHeight: 1.5 }}>
        Source: <strong>{meta.source}</strong> · {meta.claimCount} claims / {meta.lineCount} lines / {meta.remittanceCount} remittances · {meta.feeScheduleSize} contracted rates.
        Money math is deterministic (no LLM, integer cents) and runs on synthetic data — set <code>EDI_USE_SAMPLE_FILES=false</code> with <code>ALLOW_REAL_PHI=true</code> after the COMPLIANCE.md gate to run on real 837/835 files.
      </p>
    </div>
  )
}
