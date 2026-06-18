import { Badge } from '@/components/ui/Badge'

// ── Palette ───────────────────────────────────────────────────
const INK   = '#16213a'
const SUB   = '#5a6473'
const FAINT = '#9aa3b2'
const LINE  = '#e9ecf2'
const GREEN = '#1a7a45'
const AMBER = '#b45309'

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

const gaps = [
  {
    patient: 'M. Castillo', patientId: 'P003', age: 71, insurance: 'Medicare',
    type: 'Annual Wellness Visit', code: 'G0439', revenue: 174,
    priority: 'high' as const,
    detail: 'Last AWV was March 2023 — over 2 years ago. Patient is due for subsequent AWV (G0439). Schedule before year end.',
    conditions: ['Rheumatoid arthritis', 'T2DM', 'Osteoporosis'],
    action: 'Schedule AWV',
  },
  {
    patient: 'R. Okonkwo', patientId: 'P001', age: 68, insurance: 'Medicare',
    type: 'CCM Enrollment', code: '99490', revenue: 62,
    priority: 'high' as const,
    detail: 'Patient has HTN, T2DM, and hyperlipidemia — qualifies for Chronic Care Management. Not currently enrolled. Worth $62/mo in recurring revenue.',
    conditions: ['Hypertension', 'T2DM', 'Hyperlipidemia'],
    action: 'Enroll in CCM',
  },
  {
    patient: 'S. Huang', patientId: 'P007', age: 79, insurance: 'Medicare',
    type: 'HCC Recapture', code: 'HCC85', revenue: 0,
    priority: 'high' as const,
    detail: 'Heart failure (HCC85) not documented in a visit this calendar year. Must be recaptured annually for risk adjustment. Affects Medicare Advantage capitation.',
    conditions: ['Alzheimers', 'Hypertension', 'Heart failure (HCC)'],
    action: 'Document at next visit',
  },
  {
    patient: 'D. Patel', patientId: 'P009', age: 66, insurance: 'Medicare',
    type: 'HbA1c overdue', code: 'lab', revenue: 0,
    priority: 'medium' as const,
    detail: 'Last HbA1c was June 2024 — over 6 months ago. Per ADA guidelines, T2DM patients with uncontrolled glucose require quarterly testing.',
    conditions: ['T2DM with hyperglycemia', 'Hypertension', 'Diabetic neuropathy'],
    action: 'Order HbA1c',
  },
  {
    patient: 'J. Martinez', patientId: 'P006', age: 62, insurance: 'Medicare',
    type: 'Annual Wellness Visit', code: 'G0439', revenue: 174,
    priority: 'medium' as const,
    detail: 'Last AWV was August 2023. Due for subsequent AWV. Lipid panel also overdue.',
    conditions: ['Hypertension', 'Hyperlipidemia'],
    action: 'Schedule AWV',
  },
  {
    patient: '4 patients', patientId: 'MULTI', age: 0, insurance: 'Medicare',
    type: 'Depression screening', code: 'G0444', revenue: 176,
    priority: 'medium' as const,
    detail: 'Four Medicare patients are due for annual depression screening (G0444, $44 each). Can be completed at any office visit using PHQ-2.',
    conditions: ['Various'],
    action: 'Screen at next visit',
  },
  {
    patient: 'T. Wilson', patientId: 'P010', age: 52, insurance: 'Commercial',
    type: 'Colorectal screening', code: 'G0328', revenue: 0,
    priority: 'low' as const,
    detail: 'Patient is 52 with family history of colorectal cancer. Due for colorectal cancer screening per USPSTF guidelines. Order FIT test or colonoscopy referral.',
    conditions: ['Family history of colorectal cancer'],
    action: 'Order screening',
  },
  {
    patient: 'L. Thompson', patientId: 'P008', age: 68, insurance: 'Medicare',
    type: 'Immunization gap', code: 'vaccine', revenue: 0,
    priority: 'low' as const,
    detail: 'No record of RSV vaccine or updated COVID booster in the past 12 months. Both recommended for patients 65+.',
    conditions: ['GERD', 'Obesity'],
    action: 'Administer at next visit',
  },
]

const priorityBadge = { high: 'red', medium: 'amber', low: 'gray' } as const

// Icon accent per gap type — small tinted tile, exactly like dashboard
const typeAccent: Record<string, string> = {
  'Annual Wellness Visit': '#2d5de8',
  'CCM Enrollment':        GREEN,
  'HCC Recapture':         AMBER,
  'HbA1c overdue':         AMBER,
  'Depression screening':  '#7c3aed',
  'Colorectal screening':  '#5a6473',
  'Immunization gap':      '#5a6473',
}

const totalRevenue = gaps.filter(g => g.revenue > 0).reduce((s, g) => s + g.revenue, 0)
const highCount = gaps.filter(g => g.priority === 'high').length

export default function GapsPage() {
  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #d9e0ea; }
        .pc-row { transition: background .12s ease; }
        .pc-row:hover { background: #fafbfd; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Care gap scanner
        </h1>
        <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
          Revenue opportunities and quality gaps across your patient panel.
        </p>
      </div>

      {/* Summary KPIs — white cards, color only on numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 34 }}>
        {[
          { label: 'Open gaps',          value: `${gaps.length}`,               sub: 'Across 8 patients',              numColor: INK,   icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, accent: '#5a6473' },
          { label: 'High priority',      value: `${highCount}`,                 sub: 'Needs attention now',            numColor: AMBER, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, accent: AMBER },
          { label: 'Recoverable revenue', value: `$${totalRevenue.toLocaleString()}`, sub: 'Direct billing + recurring', numColor: GREEN, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M11 4H6.5a2.5 2.5 0 000 5h3a2.5 2.5 0 010 5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, accent: GREEN },
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

      {/* Gap list */}
      <SectionLabel meta={`${gaps.length} gaps`}>All care gaps</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gaps.map((g, i) => {
          const accent = typeAccent[g.type] || '#5a6473'
          return (
            <div key={i} className="pc-card" style={card}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>

                {/* Type icon tile */}
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700 }}>{g.code.slice(0, 3)}</span>
                </div>

                {/* Detail */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{g.patient}</span>
                    {g.age > 0 && <span style={{ fontSize: 12, color: FAINT }}>Age {g.age} · {g.insurance}</span>}
                    <Badge label={g.priority} variant={priorityBadge[g.priority]} />
                    {g.revenue > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>
                        +${g.revenue}{g.type === 'CCM Enrollment' ? '/mo' : ''}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: SUB, margin: '0 0 4px' }}>
                    {g.type}
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: FAINT, marginLeft: 8, fontWeight: 400 }}>{g.code}</span>
                  </p>
                  <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 8px', lineHeight: 1.5 }}>{g.detail}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {g.conditions.map((c, j) => (
                      <span key={j} style={{ fontSize: 11, background: '#f3f5f9', color: SUB, padding: '2px 8px', borderRadius: 99 }}>{c}</span>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <button style={{
                  padding: '7px 14px', background: '#f5f8ff', color: '#2d5de8',
                  fontSize: 12.5, fontWeight: 500, borderRadius: 8,
                  border: '1px solid #dce6ff', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {g.action}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
