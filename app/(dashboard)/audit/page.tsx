import { Badge } from '@/components/ui/Badge'

// ── Palette ───────────────────────────────────────────────────
const INK   = '#16213a'
const SUB   = '#5a6473'
const FAINT = '#9aa3b2'
const LINE  = '#e9ecf2'
const GREEN = '#1a7a45'
const AMBER = '#b45309'
const RED   = '#c9302c'

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  boxShadow: '0 1px 3px rgba(15,21,32,0.04)',
}

function SectionLabel({ children, meta }: { children: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
      <div style={{ height: 1, flex: 1, background: LINE }} />
      {meta && <span style={{ fontSize: 11.5, color: FAINT }}>{meta}</span>}
    </div>
  )
}

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

const severityAccent: Record<string, string> = { high: RED, medium: AMBER, low: '#2d5de8' }

const RAC_TARGETS = ['99215', '99214', 'G0439', 'G0438', '99490', '99213', 'Mod-25', 'Mod-59']
const OIG_2025 = ['G0438/G0439', '99490', '99215', 'Telehealth E&M', 'Chronic pain management']

export default function AuditPage() {
  const highCount = risks.filter(r => r.severity === 'high').length
  const totalClaims = risks.reduce((s, r) => s + r.affectedClaims, 0)

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #d9e0ea; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Audit shield
        </h1>
        <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
          RAC and OIG risk scoring based on your billing patterns vs national benchmarks.
        </p>
      </div>

      {/* Summary KPIs — white cards, color only on numbers/icons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 34 }}>
        {[
          {
            label: 'Overall risk level', value: 'Medium', sub: 'Based on current patterns',
            numColor: AMBER, accent: AMBER,
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
          },
          {
            label: 'High severity flags', value: `${highCount}`, sub: 'Immediate attention needed',
            numColor: AMBER, accent: AMBER,
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
          },
          {
            label: 'Claims at risk', value: `${totalClaims}`, sub: 'Across all flag types',
            numColor: INK, accent: '#5a6473',
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
          },
        ].map((s, i) => (
          <div key={i} className="pc-card" style={card}>
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.accent}14`, color: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 3px', color: s.numColor, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                <p style={{ fontSize: 12, color: FAINT, margin: 0 }}>{s.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk cards */}
      <SectionLabel meta={`${risks.length} flags`}>Risk flags</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 34 }}>
        {risks.map((r, i) => {
          const accent = severityAccent[r.severity]
          return (
            <div key={i} className="pc-card" style={card}>
              {/* Header */}
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${LINE}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 700 }}>{r.code.slice(0, 5)}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, flex: 1 }}>{r.type}</span>
                <span style={{ fontSize: 12, color: FAINT }}>{r.affectedClaims} claims affected</span>
                <Badge label={r.severity} variant={severityBadge[r.severity]} />
                <Badge label={statusLabel[r.status].label} variant={statusLabel[r.status].variant} />
              </div>

              <div style={{ padding: '16px 20px' }}>
                {/* Rate comparison bar (only for pattern-based risks) */}
                {r.barYours > 0 && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f8f9fb', borderRadius: 10, border: `1px solid ${LINE}` }}>
                    <div style={{ display: 'flex', gap: 24 }}>
                      {[
                        { label: 'Your rate', value: r.rateYours, bar: r.barYours, color: r.severity === 'high' ? RED : AMBER },
                        { label: 'Peer benchmark', value: r.ratePeer, bar: r.barPeer, color: GREEN },
                        { label: 'RAC threshold', value: r.rateThreshold, bar: 0, color: FAINT },
                      ].map((item, j) => (
                        <div key={j} style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: FAINT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
                          </div>
                          {item.bar > 0 && (
                            <div style={{ height: 4, background: LINE, borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(item.bar * 2, 100)}%`, background: item.color, borderRadius: 2 }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 13, color: SUB, lineHeight: 1.6, margin: '0 0 12px' }}>{r.description}</p>

                <div style={{ padding: '10px 14px', background: '#f5f8ff', borderRadius: 10, border: '1px solid #dce6ff' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#2d5de8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recommendation</p>
                  <p style={{ fontSize: 12.5, color: SUB, margin: 0, lineHeight: 1.5 }}>{r.recommendation}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* RAC & OIG reference */}
      <SectionLabel>Reference</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Active RAC audit targets</span>
          </div>
          <div style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {RAC_TARGETS.map((t, i) => (
                <span key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, background: '#f3f5f9', color: SUB, padding: '3px 10px', borderRadius: 6, border: `1px solid ${LINE}` }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: FAINT, margin: 0 }}>Source: CMS RAC Activity Report 2025</p>
          </div>
        </div>
        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>OIG 2025 Work Plan — primary care</span>
          </div>
          <div style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {OIG_2025.map((t, i) => (
                <span key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, background: `${AMBER}09`, color: AMBER, padding: '3px 10px', borderRadius: 6, border: `1px solid ${AMBER}28` }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: FAINT, margin: 0 }}>Source: OIG Work Plan, updated Q1 2025</p>
          </div>
        </div>
      </div>
    </div>
  )
}
