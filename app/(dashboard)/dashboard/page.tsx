import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'

// ── Mock data ─────────────────────────────────────────────────

const urgentActions = [
  {
    module: 'Coding',
    href: '/coding',
    color: '#b45309',
    bg: '#fffbf0',
    border: '#fef3d0',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: '3 coding suggestions pending',
    detail: 'R. Okonkwo, D. Patel, M. Castillo — approve before claims go out today',
    value: '+$310',
    valueLabel: 'recoverable',
    cta: 'Review & approve →',
  },
  {
    module: 'Practice Pulse',
    href: '/pulse',
    color: '#c9302c',
    bg: '#fff5f5',
    border: '#ffe0e0',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 8h2.5l2-5 2 10 2-6 1.5 3H15" stroke="#c9302c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: '2 critical billing issues',
    detail: 'Claim CLM-28841 stuck 47 days · D. Patel HbA1c 9.2% unreviewed',
    value: '$379',
    valueLabel: 'at risk',
    cta: 'View issues →',
  },
  {
    module: 'Schedule',
    href: '/schedule',
    color: '#c9302c',
    bg: '#fff5f5',
    border: '#ffe0e0',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="#c9302c" strokeWidth="1.5"/>
        <path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="#c9302c" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: '2 high no-show risk slots',
    detail: 'B. Nwosu 10:00am (82%) · T. Larsson 11:30am (71%) — call to confirm',
    value: '2 slots',
    valueLabel: 'at risk',
    cta: 'View schedule →',
  },
  {
    module: 'Audit Shield',
    href: '/audit',
    color: '#c9302c',
    bg: '#fff5f5',
    border: '#ffe0e0',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="#c9302c" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    title: '99215 rate above RAC threshold',
    detail: 'Your rate 31% vs 25% threshold — 2 notes missing MDM documentation',
    value: 'Medium',
    valueLabel: 'audit risk',
    cta: 'Review risks →',
  },
]

const moduleOverview = [
  {
    href: '/coding',
    label: 'Coding',
    icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    metric: '$310',
    metricLabel: 'recoverable today',
    badge: { label: '3 pending', variant: 'amber' as const },
    trend: '+$68 avg per flag',
    status: 'warning' as const,
  },
  {
    href: '/gaps',
    label: 'Care Gaps',
    icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    metric: '$2,100',
    metricLabel: 'recoverable this month',
    badge: { label: '8 open', variant: 'gray' as const },
    trend: 'AWV + CCM highest priority',
    status: 'default' as const,
  },
  {
    href: '/audit',
    label: 'Audit Shield',
    icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
    metric: 'Medium',
    metricLabel: 'overall risk level',
    badge: { label: '2 high flags', variant: 'red' as const },
    trend: 'CO-97 pattern affecting 4 claims',
    status: 'danger' as const,
  },
  {
    href: '/pulse',
    label: 'Practice Pulse',
    icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M1 8h2.5l2-5 2 10 2-6 1.5 3H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    metric: '7',
    metricLabel: 'open issues',
    badge: { label: '$1,424 at risk', variant: 'red' as const },
    trend: '4 unreviewed labs · 4 balances due',
    status: 'danger' as const,
  },
  {
    href: '/schedule',
    label: 'Schedule',
    icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    metric: '6',
    metricLabel: 'patients today',
    badge: { label: '2 high risk', variant: 'red' as const },
    trend: 'Avg no-show risk 32%',
    status: 'warning' as const,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 12l3.5-4 3 3 3-6L15 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    metric: '$65.8k',
    metricLabel: 'projected May revenue',
    badge: { label: '+39% YoY', variant: 'green' as const },
    trend: 'DAR 36 days · clean claim 88%',
    status: 'success' as const,
  },
]

const topCareGaps = [
  { patient: 'M. Castillo', type: 'Annual Wellness Visit', code: 'G0439', revenue: '$174',    priority: 'high' as const },
  { patient: 'R. Okonkwo',  type: 'CCM Enrollment',       code: '99490', revenue: '+$62/mo', priority: 'high' as const },
  { patient: 'D. Patel',    type: 'HbA1c overdue',        code: 'lab',   revenue: 'recall',  priority: 'medium' as const },
]

const weekRevenue = [
  { label: 'Feb', v: 50100 },
  { label: 'Mar', v: 52400 },
  { label: 'Apr', v: 53100 },
  { label: 'May', v: 65800, projected: true },
]
const maxRev = Math.max(...weekRevenue.map(w => w.v))

const statusStyles = {
  default: { bg: '#fff',     border: '#e4e8ef', metricColor: '#1e2533' },
  warning: { bg: '#fffbf0',  border: '#fef3d0', metricColor: '#b45309' },
  danger:  { bg: '#fff5f5',  border: '#ffe0e0', metricColor: '#c9302c' },
  success: { bg: '#f0faf4',  border: '#dcf4e8', metricColor: '#1a7a45' },
}

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Good morning, Dr. Blair
          </h1>
          <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
            {today} &nbsp;·&nbsp; 6 patients scheduled &nbsp;·&nbsp;
            <span style={{ color: '#34d399' }}>●</span> Synced 6:02am
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>Est. revenue today</p>
          <p style={{ fontSize: '26px', fontWeight: '700', color: '#1a7a45', margin: 0, letterSpacing: '-0.02em' }}>$2,840</p>
          <p style={{ fontSize: '11px', color: '#1a7a45', margin: '2px 0 0' }}>↑ $310 vs avg · $480 leakage flagged</p>
        </div>
      </div>

      {/* ── SECTION 1: Urgent actions ── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Needs attention today
          </h2>
          <div style={{ height: '1px', flex: 1, background: '#f1f3f7' }} />
          <span style={{ fontSize: '11px', color: '#9aa3b2' }}>4 items</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {urgentActions.map((action, i) => (
            <Link key={i} href={action.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: action.bg, border: `1px solid ${action.border}`,
                borderRadius: '12px', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                boxShadow: '0 1px 3px rgba(15,21,32,0.04)',
                transition: 'box-shadow 0.15s', cursor: 'pointer',
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${action.border}` }}>
                  {action.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                    <p style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e2533', margin: 0, lineHeight: '1.3' }}>{action.title}</p>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: action.color, margin: 0 }}>{action.value}</p>
                      <p style={{ fontSize: '10px', color: '#9aa3b2', margin: 0 }}>{action.valueLabel}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7585', margin: '0 0 8px', lineHeight: '1.5' }}>{action.detail}</p>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: action.color }}>{action.cta}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: Practice overview ── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Practice overview
          </h2>
          <div style={{ height: '1px', flex: 1, background: '#f1f3f7' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {moduleOverview.map((mod, i) => {
            const s = statusStyles[mod.status]
            return (
              <Link key={i} href={mod.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: s.bg, border: `1px solid ${s.border}`,
                  borderRadius: '12px', padding: '14px 16px',
                  boxShadow: '0 1px 3px rgba(15,21,32,0.04)', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ color: '#9aa3b2' }}>{mod.icon}</span>
                      <span style={{ fontSize: '12.5px', fontWeight: '500', color: '#4a5366' }}>{mod.label}</span>
                    </div>
                    <Badge label={mod.badge.label} variant={mod.badge.variant} />
                  </div>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: s.metricColor, margin: '0 0 2px', letterSpacing: '-0.02em' }}>{mod.metric}</p>
                  <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '0 0 6px' }}>{mod.metricLabel}</p>
                  <p style={{ fontSize: '11.5px', color: '#6b7585', margin: 0 }}>{mod.trend}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── SECTION 3: Care gaps + Revenue trend ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>

        {/* Top care gaps */}
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Top care gap opportunities</span>
            <Badge label="$2,100+ recoverable" variant="green" />
          </div>
          <div style={{ padding: '0' }}>
            {topCareGaps.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 18px', borderBottom: i < topCareGaps.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: '#1e2533', margin: '0 0 2px' }}>{g.patient}</p>
                  <p style={{ fontSize: '12px', color: '#6b7585', margin: 0 }}>{g.type}</p>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', background: '#f1f3f7', color: '#4a5366', padding: '2px 7px', borderRadius: '4px' }}>{g.code}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a7a45', minWidth: '60px', textAlign: 'right' }}>{g.revenue}</span>
                <Badge label={g.priority} variant={g.priority === 'high' ? 'red' : 'amber'} />
              </div>
            ))}
            <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f3f7' }}>
              <Link href="/gaps" style={{ fontSize: '12px', color: '#3b6ef8', fontWeight: '500', textDecoration: 'none' }}>View all 8 care gaps →</Link>
            </div>
          </div>
        </div>

        {/* Revenue trend */}
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', boxShadow: '0 1px 3px rgba(15,21,32,0.04)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Monthly revenue</span>
            <Link href="/analytics" style={{ fontSize: '12px', color: '#3b6ef8', fontWeight: '500', textDecoration: 'none', position: 'relative', zIndex: 10 }}>Full analytics →</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '100px', marginBottom: '10px' }}>
            {weekRevenue.map((w, i) => {
              const h = (w.v / maxRev) * 90
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: w.projected ? '#34d399' : '#1a7a45' }}>
                    ${(w.v / 1000).toFixed(0)}k
                  </span>
                  <div style={{ width: '100%', height: `${h}px`, borderRadius: '4px 4px 0 0', background: w.projected ? 'transparent' : '#3b6ef8', position: 'relative', minHeight: '4px' }}>
                    {w.projected && <div style={{ position: 'absolute', inset: 0, border: '2px dashed #34d399', borderRadius: '4px 4px 0 0' }} />}
                  </div>
                  <span style={{ fontSize: '11px', color: w.projected ? '#34d399' : '#9aa3b2', fontWeight: w.projected ? '600' : '400' }}>{w.label}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 0 0', borderTop: '1px solid #f1f3f7', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#9aa3b2' }}>DAR: <strong style={{ color: '#b45309' }}>36 days</strong> · benchmark 32</span>
            <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Clean claims: <strong style={{ color: '#b45309' }}>88%</strong> · benchmark 95%</span>
          </div>
        </div>
      </div>

    </div>
  )
}
