import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { runRcmCycle, type RcmReport } from '@/lib/rcm/run'
import type { ClaimStatus } from '@/lib/rcm/lifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<ClaimStatus, { variant: 'green' | 'red' | 'amber' | 'blue' | 'gray' }> = {
  paid: { variant: 'green' },
  partially_paid: { variant: 'amber' },
  denied: { variant: 'red' },
  rejected: { variant: 'gray' },
  submitted: { variant: 'blue' },
  built: { variant: 'gray' },
}

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa3b2',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #e4e8ef',
}
const td: React.CSSProperties = {
  fontSize: 13, color: '#333d4d', padding: '11px 12px', borderBottom: '1px solid #f1f3f7', verticalAlign: 'top',
}

export default function ClaimsPage() {
  let report: RcmReport | null = null
  let error: string | null = null
  try {
    report = runRcmCycle()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (!report) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1e2533', margin: '0 0 4px' }}>Claims (RCM)</h1>
        <div style={{ marginTop: 16, background: '#fff5f5', border: '1px solid #ffe0e0', borderRadius: 12, padding: '14px 18px', color: '#c9302c', fontSize: 13 }}>
          Could not run the RCM cycle: {error}
        </div>
      </div>
    )
  }

  const { totals, claims } = report

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Claims (RCM)</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          In-house billing: generate the 837, submit, post the 835, and work denials — instead of paying a billing company a percentage of revenue.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '18px 0 22px' }}>
        <StatCard label="Submitted" value={String(totals.submitted)} delta={`${totals.accepted} accepted · ${totals.rejected} rejected`} />
        <StatCard label="Paid" value={`${totals.paid}`} delta={`${totals.partiallyPaid} partial`} />
        <StatCard label="Denied" value={`${totals.denied}`} delta="needs appeal" accent={totals.denied > 0 ? 'danger' : 'default'} />
        <StatCard label="Recovery worklist" value={formatCents(totals.recoverableCents)} delta={`${report.findings.length} findings`} accent="warning" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2533' }}>Claim lifecycle</span>
          <span style={{ fontSize: 12, color: '#9aa3b2' }}>mock clearinghouse · synthetic data</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Claim</th>
              <th style={th}>Payer claim #</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Billed</th>
              <th style={{ ...th, textAlign: 'right' }}>Paid</th>
              <th style={th}>Note</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.claimControlNumber}>
                <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{c.claimControlNumber}</td>
                <td style={{ ...td, color: '#6b7280' }}>{c.payerClaimControlNumber ?? '—'}</td>
                <td style={td}><Badge label={c.status.replace('_', ' ')} variant={STATUS_BADGE[c.status].variant} /></td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.billedCents)}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.paidCents > 0 ? '#1a7a45' : '#9aa3b2' }}>{formatCents(c.paidCents)}</td>
                <td style={{ ...td, color: '#6b7280' }}>{c.status === 'rejected' ? c.rejectReason : c.status === 'denied' ? 'Appealable — see Found Money' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: '#9aa3b2', marginTop: 14, lineHeight: 1.5 }}>
        Running against a <strong>mock clearinghouse</strong> on synthetic data (the <code>ATHENA_USE_MOCK</code> posture). A real clearinghouse adapter (Availity / Change / Claim.MD / Stedi / Office Ally) swaps in behind the same interface — gated on payer EDI enrollment and a signed BAA (<code>ALLOW_REAL_PHI=true</code>).
      </p>
    </div>
  )
}
