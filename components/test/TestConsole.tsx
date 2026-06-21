import Link from 'next/link'
import { MODULES } from '@/lib/admin/modules'
import { AthenaPullButton } from '@/components/ehr/AthenaPullButton'
import { EligibilityTestButton } from '@/components/test/EligibilityTestButton'

/**
 * One place to exercise the whole app on synthetic data. The two live actions run
 * the interactive features end to end; the checklist links every read-only module
 * so you can verify each one. The billing-submission rails are intentionally off —
 * athena runs billing — so they're listed as delegated, not test targets.
 */

// Claim-submission / money-movement rails athena owns (the "except billing" set).
const BILLING_OFF = new Set(['claims', 'clearinghouse', 'enrollments', 'scrub', 'billing'])

const panel: React.CSSProperties = { background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden', marginBottom: 22 }
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7a8a80', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }

export function TestConsole() {
  const testable = MODULES.filter((m) => !BILLING_OFF.has(m.id) && m.id !== 'upload')
  const billingOff = MODULES.filter((m) => BILLING_OFF.has(m.id))

  return (
    <div style={panel}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ece3', background: 'linear-gradient(135deg, #f3f8f5 0%, #fff 70%)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1f2d27', margin: '0 0 3px', letterSpacing: '-0.01em' }}>Test Console</h2>
        <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0 }}>Exercise every feature on synthetic data — no PHI. Run the live actions, then click through each module.</p>
      </div>

      {/* Live actions */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0ece3' }}>
        <p style={sectionLabel}>Run the value loop</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>
            <p style={{ fontSize: 12.5, color: '#4b5b52', margin: '0 0 8px', fontWeight: 500 }}>athena → found-money → Neon</p>
            <AthenaPullButton />
          </div>
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>
            <p style={{ fontSize: 12.5, color: '#4b5b52', margin: '0 0 8px', fontWeight: 500 }}>Real-time benefits (Stedi sandbox)</p>
            <EligibilityTestButton />
          </div>
        </div>
      </div>

      {/* Module checklist */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0ece3' }}>
        <p style={sectionLabel}>Walk every module · {testable.length}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(228px, 1fr))', gap: 10 }}>
          {testable.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              style={{ display: 'block', textDecoration: 'none', background: '#fbfaf7', border: '1px solid #ece7dd', borderRadius: 10, padding: '11px 13px' }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2d27', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {m.label}
                <span style={{ color: '#9aa69f', fontWeight: 400 }}>→</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#8a948c', marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Billing rails — off */}
      <div style={{ padding: '14px 20px', background: '#faf8f4' }}>
        <p style={{ ...sectionLabel, margin: '0 0 8px' }}>Billing rails — off · athena runs billing</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {billingOff.map((m) => (
            <span key={m.id} style={{ fontSize: 12, color: '#9aa69f', background: '#f0ece3', border: '1px solid #e7e1d6', borderRadius: 999, padding: '4px 11px' }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
