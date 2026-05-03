#!/bin/bash
# CodeCompanion — Phase 4 Setup Script
# Builds Care Gaps, Audit Shield, and Schedule modules
# Run from repo root: bash setup-phase4.sh

set -e
echo "🏗️  Building Phase 4 — Care Gaps, Audit Shield, Schedule..."

# ── app/(dashboard)/gaps/page.tsx ────────────────────────────
cat > "app/(dashboard)/gaps/page.tsx" << 'EOF'
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
EOF
echo "✓ app/(dashboard)/gaps/page.tsx"

# ── app/(dashboard)/audit/page.tsx ───────────────────────────
cat > "app/(dashboard)/audit/page.tsx" << 'EOF'
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
EOF
echo "✓ app/(dashboard)/audit/page.tsx"

# ── app/(dashboard)/schedule/page.tsx ────────────────────────
cat > "app/(dashboard)/schedule/page.tsx" << 'EOF'
import { Badge } from '@/components/ui/Badge'

const appointments = [
  {
    time: '9:00 AM', patient: 'R. Okonkwo', patientId: 'P001', age: 68,
    type: 'Follow-up', insurance: 'Medicare',
    noShowPct: 12,
    level: 'low' as const,
    history: { total: 18, noShows: 2, lastVisit: '2 months ago', lastStatus: 'Arrived' },
    factors: ['Consistent attendance history', 'Long-standing patient', 'Medicare — typically reliable'],
    recommendation: 'No action needed.',
  },
  {
    time: '10:00 AM', patient: 'B. Nwosu', patientId: 'P011', age: 34,
    type: 'New patient', insurance: 'Medicaid',
    noShowPct: 82,
    level: 'high' as const,
    history: { total: 3, noShows: 2, lastVisit: '8 months ago', lastStatus: 'No Show' },
    factors: ['New patient — no established relationship', '2 of 3 prior visits were no-shows', 'Last appointment was a no-show', 'Morning slot — lower show rate'],
    recommendation: 'Call to confirm today. Consider double-booking this slot with a short-visit patient.',
  },
  {
    time: '11:00 AM', patient: 'M. Castillo', patientId: 'P003', age: 71,
    type: 'Follow-up', insurance: 'Medicare',
    noShowPct: 8,
    level: 'low' as const,
    history: { total: 24, noShows: 1, lastVisit: '3 months ago', lastStatus: 'Arrived' },
    factors: ['Strong attendance history', 'Long-term patient', 'Confirmed by phone yesterday'],
    recommendation: 'No action needed.',
  },
  {
    time: '11:30 AM', patient: 'T. Larsson', patientId: 'P012', age: 28,
    type: 'Sick visit', insurance: 'Commercial',
    noShowPct: 71,
    level: 'high' as const,
    history: { total: 6, noShows: 3, lastVisit: '5 months ago', lastStatus: 'No Show' },
    factors: ['50% historical no-show rate', 'Last appointment was a no-show', 'Younger patients show lower adherence', 'Same-day booking — higher cancellation risk'],
    recommendation: 'Text reminder immediately. If no confirmation by 10am, open slot to same-day waitlist.',
  },
  {
    time: '2:00 PM', patient: 'F. Adeola', patientId: 'P013', age: 55,
    type: 'Annual physical', insurance: 'Commercial',
    noShowPct: 22,
    level: 'medium' as const,
    history: { total: 12, noShows: 2, lastVisit: '1 year ago', lastStatus: 'Arrived' },
    factors: ['Annual physical — patients occasionally forget', 'Booked 3 weeks ago', 'No recent contact'],
    recommendation: 'Standard reminder sent. No additional action needed.',
  },
  {
    time: '3:00 PM', patient: 'D. Patel', patientId: 'P009', age: 66,
    type: 'Follow-up', insurance: 'Medicare',
    noShowPct: 15,
    level: 'low' as const,
    history: { total: 20, noShows: 2, lastVisit: '6 weeks ago', lastStatus: 'Arrived' },
    factors: ['Reliable attendance', 'Medicare patient', 'Afternoon slot — higher show rate'],
    recommendation: 'No action needed.',
  },
  {
    time: '3:45 PM', patient: 'C. Dimitriou', patientId: 'P014', age: 61,
    type: 'Follow-up', insurance: 'Medicare',
    noShowPct: 15,
    level: 'low' as const,
    history: { total: 15, noShows: 1, lastVisit: '3 months ago', lastStatus: 'Arrived' },
    factors: ['Reliable attendance', 'Confirmed by patient portal'],
    recommendation: 'No action needed.',
  },
]

const levelColor = { high: '#f87171', medium: '#fbbf24', low: '#34d399' }
const levelBg    = { high: '#fff5f5', medium: '#fffbf0', low: '#f0faf4' }
const levelBorder = { high: '#ffe0e0', medium: '#fef3d0', low: '#dcf4e8' }
const levelBadge = { high: 'red', medium: 'amber', low: 'green' } as const

const highRisk  = appointments.filter(a => a.level === 'high').length
const medRisk   = appointments.filter(a => a.level === 'medium').length
const avgNoShow = Math.round(appointments.reduce((s, a) => s + a.noShowPct, 0) / appointments.length)

export default function SchedulePage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Schedule risk
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>{today} · {appointments.length} appointments</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'High risk slots', value: `${highRisk}`, sub: 'Recommend action', accent: 'danger' },
          { label: 'Medium risk slots', value: `${medRisk}`, sub: 'Monitor closely', accent: 'warning' },
          { label: 'Avg no-show risk', value: `${avgNoShow}%`, sub: 'Across today\'s schedule', accent: 'default' },
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

      {/* Schedule */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {appointments.map((a, i) => (
          <div key={i} style={{
            background: a.level === 'high' ? levelBg.high : '#fff',
            border: `1px solid ${a.level === 'high' ? levelBorder.high : '#e4e8ef'}`,
            borderRadius: '12px', padding: '14px 20px',
            boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>

              {/* Time */}
              <div style={{ width: '70px', flexShrink: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#333d4d', margin: 0 }}>{a.time}</p>
                <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '2px 0 0' }}>{a.type}</p>
              </div>

              {/* Patient info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{a.patient}</span>
                  <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Age {a.age} · {a.insurance}</span>
                  <Badge label={a.level === 'high' ? 'High risk' : a.level === 'medium' ? 'Medium risk' : 'Low risk'} variant={levelBadge[a.level]} />
                </div>

                {/* History pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: a.level !== 'low' ? '10px' : '0' }}>
                  <span style={{ fontSize: '11px', background: '#f1f3f7', color: '#6b7585', padding: '2px 8px', borderRadius: '99px' }}>
                    {a.history.noShows}/{a.history.total} no-shows
                  </span>
                  <span style={{ fontSize: '11px', background: '#f1f3f7', color: '#6b7585', padding: '2px 8px', borderRadius: '99px' }}>
                    Last visit: {a.history.lastVisit}
                  </span>
                  <span style={{ fontSize: '11px', background: a.history.lastStatus === 'No Show' ? '#fff5f5' : '#f0faf4', color: a.history.lastStatus === 'No Show' ? '#c9302c' : '#1a7a45', padding: '2px 8px', borderRadius: '99px' }}>
                    Last: {a.history.lastStatus}
                  </span>
                </div>

                {/* Risk factors & recommendation (high/medium only) */}
                {a.level !== 'low' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '8px 12px', background: '#f8f9fb', borderRadius: '8px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>Risk factors</p>
                      {a.factors.map((f, j) => (
                        <p key={j} style={{ fontSize: '12px', color: '#4a5366', margin: j < a.factors.length - 1 ? '0 0 2px' : 0 }}>• {f}</p>
                      ))}
                    </div>
                    <div style={{ padding: '8px 12px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid #dce6ff' }}>
                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>Recommendation</p>
                      <p style={{ fontSize: '12px', color: '#1e4acc', margin: 0, lineHeight: '1.5' }}>{a.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk gauge */}
              <div style={{ textAlign: 'center', flexShrink: 0, width: '64px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: `conic-gradient(${levelColor[a.level]} ${a.noShowPct * 3.6}deg, #f1f3f7 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 4px',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: '700', color: levelColor[a.level],
                  }}>
                    {a.noShowPct}%
                  </div>
                </div>
                <p style={{ fontSize: '10px', color: '#9aa3b2', margin: 0 }}>no-show</p>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Waitlist tip */}
      <div style={{
        marginTop: '16px', padding: '12px 16px',
        background: '#f0f4ff', borderRadius: '10px', border: '1px solid #dce6ff',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#3b6ef8" strokeWidth="1.5"/>
          <path d="M8 5v3.5l2 1.5" stroke="#3b6ef8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: '12.5px', color: '#2d5de8', margin: 0 }}>
          <strong>Tip:</strong> The 10:00 AM and 11:30 AM slots are high risk. Consider maintaining a 2-patient same-day waitlist to fill gaps if either no-shows.
        </p>
      </div>

    </div>
  )
}
EOF
echo "✓ app/(dashboard)/schedule/page.tsx"

# ── Settings page polish ─────────────────────────────────────
cat > "app/(dashboard)/settings/page.tsx" << 'EOF'
import { Badge } from '@/components/ui/Badge'

const sections = [
  {
    title: 'Athena EHR connection',
    items: [
      { label: 'Connection status', value: 'Mock data (dev mode)', badge: { label: 'Not connected', variant: 'amber' as const } },
      { label: 'Practice ID', value: 'Pending Athena credentials', badge: null },
      { label: 'Last sync', value: 'N/A', badge: null },
      { label: 'API version', value: 'FHIR R4 + Proprietary', badge: null },
    ],
    action: { label: 'Connect Athena', color: '#2d5de8', bg: '#f0f4ff', border: '#dce6ff' },
    note: 'Register at docs.athenahealth.com for developer credentials. Sandbox access is immediate.',
  },
  {
    title: 'Subscription',
    items: [
      { label: 'Current plan', value: 'Professional', badge: { label: 'Active', variant: 'green' as const } },
      { label: 'Billing', value: '$599 / month', badge: null },
      { label: 'Next renewal', value: 'June 3, 2026', badge: null },
      { label: 'Modules', value: 'All 5 modules enabled', badge: null },
    ],
    action: { label: 'Manage billing', color: '#4a5366', bg: '#f8f9fb', border: '#e4e8ef' },
    note: null,
  },
  {
    title: 'HIPAA & compliance',
    items: [
      { label: 'Supabase BAA', value: 'Required before production', badge: { label: 'Pending', variant: 'amber' as const } },
      { label: 'Anthropic BAA', value: 'Required for coding module', badge: { label: 'Pending', variant: 'amber' as const } },
      { label: 'Data storage', value: 'Derived signals only — no raw PHI', badge: { label: 'Compliant', variant: 'green' as const } },
      { label: 'Encryption', value: 'At rest + in transit', badge: { label: 'Active', variant: 'green' as const } },
    ],
    action: { label: 'Sign BAAs', color: '#c9302c', bg: '#fff5f5', border: '#ffe0e0' },
    note: 'Sign both BAAs before going live with real patient data.',
  },
  {
    title: 'AI configuration',
    items: [
      { label: 'Model', value: 'claude-sonnet-4-20250514', badge: null },
      { label: 'Cost per encounter', value: '~$0.008', badge: { label: 'Estimated', variant: 'gray' as const } },
      { label: 'Monthly AI cost', value: '~$8 at current volume', badge: null },
      { label: 'Note retention', value: 'Zero — notes never stored', badge: { label: 'HIPAA safe', variant: 'green' as const } },
    ],
    action: null,
    note: null,
  },
]

export default function SettingsPage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>Practice configuration, integrations, and compliance.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {sections.map((section, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{section.title}</span>
              {section.action && (
                <button style={{
                  padding: '6px 14px', fontSize: '12.5px', fontWeight: '500',
                  background: section.action.bg, color: section.action.color,
                  border: `1px solid ${section.action.border}`, borderRadius: '8px', cursor: 'pointer',
                }}>
                  {section.action.label}
                </button>
              )}
            </div>
            <div style={{ padding: '4px 0' }}>
              {section.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: j < section.items.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                  <span style={{ fontSize: '13px', color: '#6b7585' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#333d4d', fontWeight: '500' }}>{item.value}</span>
                    {item.badge && <Badge label={item.badge.label} variant={item.badge.variant} />}
                  </div>
                </div>
              ))}
            </div>
            {section.note && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f3f7', background: '#f8f9fb' }}>
                <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{section.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/settings/page.tsx"

echo ""
echo "✅ Phase 4 complete — all 5 modules built!"
echo ""
echo "Modules done:"
echo "  ✓ Dashboard"
echo "  ✓ Coding suggestions"
echo "  ✓ Care gaps"
echo "  ✓ Audit shield"
echo "  ✓ Schedule risk"
echo "  ✓ Settings"
echo ""
echo "Next: git add . && git commit -m 'Phase 4: all modules complete'"
echo "Then come back to chat for Phase 5 — Supabase persistence + live data"