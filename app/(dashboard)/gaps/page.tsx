import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

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
const typeColor: Record<string, string> = {
  'Annual Wellness Visit': '#dce6ff',
  'CCM Enrollment': '#dcf4e8',
  'HCC Recapture': '#ffe0e0',
  'HbA1c overdue': '#fef3d0',
  'Depression screening': '#f0f4ff',
  'Colorectal screening': '#f1f3f7',
  'Immunization gap': '#f1f3f7',
}

const totalRevenue = gaps.filter(g => g.revenue > 0).reduce((s, g) => s + g.revenue, 0)
const highCount = gaps.filter(g => g.priority === 'high').length

export default function GapsPage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Care gap scanner
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
          Revenue opportunities and quality gaps across your patient panel.
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Open gaps', value: `${gaps.length}`, sub: 'Across 8 patients', accent: 'default' },
          { label: 'High priority', value: `${highCount}`, sub: 'Needs attention now', accent: 'danger' },
          { label: 'Recoverable revenue', value: `$${totalRevenue.toLocaleString()}`, sub: 'Direct billing + recurring', accent: 'success' },
        ].map((s, i) => (
          <div key={i} style={{
            background: s.accent === 'danger' ? '#fff5f5' : s.accent === 'success' ? '#f0faf4' : '#fff',
            border: `1px solid ${s.accent === 'danger' ? '#ffe0e0' : s.accent === 'success' ? '#dcf4e8' : '#e4e8ef'}`,
            borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 4px', color: s.accent === 'danger' ? '#c9302c' : s.accent === 'success' ? '#1a7a45' : '#1e2533' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Gap list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {gaps.map((g, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px',
            padding: '16px 20px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

              {/* Type pill */}
              <div style={{
                background: typeColor[g.type] || '#f1f3f7',
                borderRadius: '8px', padding: '8px 12px', flexShrink: 0, minWidth: '160px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#4a5366', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.type}</p>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#3b6ef8', fontWeight: '500' }}>{g.code}</span>
              </div>

              {/* Detail */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{g.patient}</span>
                  {g.age > 0 && <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Age {g.age} · {g.insurance}</span>}
                  <Badge label={g.priority} variant={priorityBadge[g.priority]} />
                  {g.revenue > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: '700', color: '#1a7a45' }}>
                      +${g.revenue}{g.type === 'CCM Enrollment' ? '/mo' : ''}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12.5px', color: '#4a5366', margin: '0 0 8px', lineHeight: '1.5' }}>{g.detail}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {g.conditions.map((c, j) => (
                    <span key={j} style={{ fontSize: '11px', background: '#f1f3f7', color: '#6b7585', padding: '2px 8px', borderRadius: '99px' }}>{c}</span>
                  ))}
                </div>
              </div>

              {/* Action */}
              <button style={{
                padding: '7px 14px', background: '#f0f4ff', color: '#2d5de8',
                fontSize: '12.5px', fontWeight: '500', borderRadius: '8px',
                border: '1px solid #dce6ff', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {g.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
