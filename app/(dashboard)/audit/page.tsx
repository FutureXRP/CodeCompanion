import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const risks = [
  {
    type: 'Upcoding pattern — 99215',
    severity: 'high' as const,
    code: '99215',
    rateYours: '31%',
    ratePeer: '18%',
    rateThreshold: '25%',
    barYours: 31,
    barPeer: 18,
    affectedClaims: 12,
    description: 'Your 99215 (high complexity E&M) rate is significantly above the national peer benchmark for primary care. RAC auditors flag practices above 25%. This does not mean your coding is wrong — but every 99215 must be fully supported by documented high complexity MDM or 40+ minutes of total time.',
    recommendation: 'Review the 12 recent 99215 claims. Ensure each has explicit MDM documentation or documented total time ≥40 minutes. Consider a self-audit of note templates.',
    status: 'action_required',
  },
  {
    type: 'Modifier 25 overuse',
    severity: 'high' as const,
    code: 'Mod-25',
    rateYours: '44%',
    ratePeer: '22%',
    rateThreshold: '30%',
    barYours: 44,
    barPeer: 22,
    affectedClaims: 8,
    description: 'Modifier 25 (significant, separately identifiable E&M on same day as procedure) is applied to 44% of office visits involving a procedure. The national benchmark is ~22%. High modifier 25 rates are a top-5 RAC audit trigger.',
    recommendation: 'Verify each modifier 25 claim has a truly separate and significant E&M documented. The note must show the E&M was unrelated to the procedure and would have been performed regardless.',
    status: 'action_required',
  },
  {
    type: 'Documentation gap — MDM',
    severity: 'medium' as const,
    code: 'MDM',
    rateYours: '—',
    ratePeer: '—',
    rateThreshold: '—',
    barYours: 0,
    barPeer: 0,
    affectedClaims: 4,
    description: '4 recent encounter notes billed at 99214 or 99215 do not contain an explicit Medical Decision Making statement. Without documented MDM, the E&M level cannot be defended in an audit.',
    recommendation: 'Add a brief MDM summary to each A&P section: "Medical decision making: moderate complexity — 2 chronic conditions with worsening, prescription drug management, ordered labs." This takes 10 seconds and audit-proofs the claim.',
    status: 'needs_review',
  },
  {
    type: 'OIG watchlist — AWV billing',
    severity: 'medium' as const,
    code: 'G0438/G0439',
    rateYours: '—',
    ratePeer: '—',
    rateThreshold: '—',
    barYours: 0,
    barPeer: 0,
    affectedClaims: 2,
    description: 'AWV codes (G0438/G0439) are on the OIG 2025 Work Plan as a focus area due to frequent confusion between initial and subsequent codes and missing required elements.',
    recommendation: 'Verify G0438 vs G0439 is correct for each patient. Ensure all required AWV elements are documented: health risk assessment, written prevention plan, and cognitive assessment.',
    status: 'monitor',
  },
  {
    type: 'CCM documentation requirements',
    severity: 'low' as const,
    code: '99490',
    rateYours: '—',
    ratePeer: '—',
    rateThreshold: '—',
    barYours: 0,
    barPeer: 0,
    affectedClaims: 3,
    description: 'CCM billing (99490) requires 20 minutes of documented clinical staff time per month plus a comprehensive care plan. 3 recent CCM claims are missing time documentation.',
    recommendation: 'Ensure monthly CCM logs record: date, staff member, time spent, and clinical activity. The care plan must be on file and updated annually.',
    status: 'needs_review',
  },
]

const severityBadge = { high: 'red', medium: 'amber', low: 'blue' } as const
const statusLabel: Record<string, { label: string; variant: 'red' | 'amber' | 'blue' | 'green' | 'gray' }> = {
  action_required: { label: 'Action required', variant: 'red' },
  needs_review:    { label: 'Needs review',    variant: 'amber' },
  monitor:         { label: 'Monitor',         variant: 'blue' },
}

const RAC_TARGETS = ['99215', '99214', 'G0439', 'G0438', '99490', '99213', 'Mod-25', 'Mod-59']
const OIG_2025 = ['G0438/G0439', '99490', '99215', 'Telehealth E&M', 'Chronic pain management']

export default function AuditPage() {
  const highCount = risks.filter(r => r.severity === 'high').length
  const totalClaims = risks.reduce((s, r) => s + r.affectedClaims, 0)

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Audit shield
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
          RAC and OIG risk scoring based on your billing patterns vs national benchmarks.
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Overall risk level', value: 'Medium', sub: 'Based on current patterns', accent: 'warning' },
          { label: 'High severity flags', value: `${highCount}`, sub: 'Immediate attention needed', accent: 'danger' },
          { label: 'Claims at risk', value: `${totalClaims}`, sub: 'Across all flag types', accent: 'default' },
        ].map((s, i) => (
          <div key={i} style={{
            background: s.accent === 'danger' ? '#fff5f5' : s.accent === 'warning' ? '#fffbf0' : '#fff',
            border: `1px solid ${s.accent === 'danger' ? '#ffe0e0' : s.accent === 'warning' ? '#fef3d0' : '#e4e8ef'}`,
            borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 4px', color: s.accent === 'danger' ? '#c9302c' : s.accent === 'warning' ? '#b45309' : '#1e2533' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Risk cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {risks.map((r, i) => (
          <div key={i} style={{
            background: '#fff', border: `1px solid ${r.severity === 'high' ? '#ffe0e0' : r.severity === 'medium' ? '#fef3d0' : '#e4e8ef'}`,
            borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px',
              borderBottom: '1px solid #f1f3f7',
              background: r.severity === 'high' ? '#fff5f5' : r.severity === 'medium' ? '#fffbf0' : '#fafbfc',
            }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>{r.code}</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533', flex: 1 }}>{r.type}</span>
              <span style={{ fontSize: '12px', color: '#9aa3b2' }}>{r.affectedClaims} claims affected</span>
              <Badge label={r.severity} variant={severityBadge[r.severity]} />
              <Badge label={statusLabel[r.status].label} variant={statusLabel[r.status].variant} />
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Rate comparison bar (only for pattern-based risks) */}
              {r.barYours > 0 && (
                <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#f8f9fb', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    {[
                      { label: 'Your rate', value: r.rateYours, bar: r.barYours, color: r.severity === 'high' ? '#f87171' : '#fbbf24' },
                      { label: 'Peer benchmark', value: r.ratePeer, bar: r.barPeer, color: '#34d399' },
                      { label: 'RAC threshold', value: r.rateThreshold, bar: 0, color: '#9aa3b2' },
                    ].map((item, j) => (
                      <div key={j} style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontSize: '11px', color: '#9aa3b2', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: item.color }}>{item.value}</span>
                        </div>
                        {item.bar > 0 && (
                          <div style={{ height: '4px', background: '#e4e8ef', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(item.bar * 2, 100)}%`, background: item.color, borderRadius: '2px' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p style={{ fontSize: '13px', color: '#4a5366', lineHeight: '1.6', margin: '0 0 12px' }}>{r.description}</p>

              <div style={{ padding: '10px 14px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid #dce6ff' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#2d5de8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recommendation</p>
                <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0, lineHeight: '1.5' }}>{r.recommendation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RAC & OIG reference */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533', margin: '0 0 12px' }}>Active RAC audit targets</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {RAC_TARGETS.map((t, i) => (
              <span key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '3px 10px', borderRadius: '6px', border: '1px solid #e4e8ef' }}>{t}</span>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '10px 0 0' }}>Source: CMS RAC Activity Report 2025</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533', margin: '0 0 12px' }}>OIG 2025 Work Plan — primary care</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {OIG_2025.map((t, i) => (
              <span key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#fff5f5', color: '#c9302c', padding: '3px 10px', borderRadius: '6px', border: '1px solid #ffe0e0' }}>{t}</span>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '10px 0 0' }}>Source: OIG Work Plan, updated Q1 2025</p>
        </div>
      </div>
    </div>
  )
}
