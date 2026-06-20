import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'

// Calm palette, shared with the landing page.
const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const RED = '#cf5547'

// ── Mock data ─────────────────────────────────────────────────

const urgentActions = [
  {
    href: '/coding',
    accent: GREEN,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    title: '3 coding suggestions pending',
    detail: 'R. Okonkwo, D. Patel, M. Castillo — approve before claims go out today',
    value: '+$310',
    valueLabel: 'recoverable',
    cta: 'Review & approve',
  },
  {
    href: '/pulse',
    accent: RED,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h2.5l2-5 2 10 2-6 1.5 3H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    title: '2 critical billing issues',
    detail: 'Claim CLM-28841 stuck 47 days · D. Patel HbA1c 9.2% unreviewed',
    value: '$379',
    valueLabel: 'at risk',
    cta: 'View issues',
  },
  {
    href: '/schedule',
    accent: AMBER,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    title: '2 high no-show risk slots',
    detail: 'B. Nwosu 10:00am (82%) · T. Larsson 11:30am (71%) — call to confirm',
    value: '2 slots',
    valueLabel: 'at risk',
    cta: 'View schedule',
  },
  {
    href: '/audit',
    accent: AMBER,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
    title: '99215 rate above RAC threshold',
    detail: 'Your rate 31% vs 25% threshold — 2 notes missing MDM documentation',
    value: 'Medium',
    valueLabel: 'audit risk',
    cta: 'Review risks',
  },
]

const moduleOverview = [
  {
    href: '/coding', label: 'Coding',
    icon: <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    metric: '$310', metricColor: GREEN, metricLabel: 'recoverable today',
    badge: { label: '3 pending', variant: 'amber' as const }, trend: '+$68 avg per flag',
  },
  {
    href: '/gaps', label: 'Care Gaps',
    icon: <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    metric: '$2,100', metricColor: GREEN, metricLabel: 'recoverable this month',
    badge: { label: '8 open', variant: 'gray' as const }, trend: 'AWV + CCM highest priority',
  },
  {
    href: '/audit', label: 'Audit Shield',
    icon: <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
    metric: 'Medium', metricColor: AMBER, metricLabel: 'overall risk level',
    badge: { label: '2 high flags', variant: 'red' as const }, trend: 'CO-97 pattern affecting 4 claims',
  },
  {
    href: '/pulse', label: 'Practice Pulse',
    icon: <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M1 8h2.5l2-5 2 10 2-6 1.5 3H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    metric: '7', metricColor: INK, metricLabel: 'open issues',
    badge: { label: '$1,424 at risk', variant: 'red' as const }, trend: '4 unreviewed labs · 4 balances due',
  },
  {
    href: '/schedule', label: 'Schedule',
    icon: <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    metric: '6', metricColor: INK, metricLabel: 'patients today',
    badge: { label: '2 high risk', variant: 'amber' as const }, trend: 'Avg no-show risk 32%',
  },
  {
    href: '/analytics', label: 'Analytics',
    icon: <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12l3.5-4 3 3 3-6L15 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    metric: '$65.8k', metricColor: GREEN, metricLabel: 'projected May revenue',
    badge: { label: '+39% YoY', variant: 'green' as const }, trend: 'DAR 36 days · clean claim 88%',
  },
]

const topCareGaps = [
  { patient: 'M. Castillo', type: 'Annual Wellness Visit', code: 'G0439', revenue: '$174', priority: 'high' as const },
  { patient: 'R. Okonkwo', type: 'CCM Enrollment', code: '99490', revenue: '+$62/mo', priority: 'high' as const },
  { patient: 'D. Patel', type: 'HbA1c overdue', code: 'lab', revenue: 'recall', priority: 'medium' as const },
]

const monthlyRevenue = [
  { label: 'Feb', v: 50100 },
  { label: 'Mar', v: 52400 },
  { label: 'Apr', v: 53100 },
  { label: 'May', v: 65800, projected: true },
]
const maxRev = Math.max(...monthlyRevenue.map((w) => w.v))

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  boxShadow: '0 1px 3px rgba(15,21,32,0.04)',
}

function SectionLabel({ children, meta }: { children: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#3f7d6a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
      <div style={{ height: 1, flex: 1, background: LINE }} />
      {meta && <span style={{ fontSize: 11.5, color: FAINT }}>{meta}</span>}
    </div>
  )
}

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #ddd6c8; }
        .pc-row { transition: background .12s ease; }
        .pc-row:hover { background: #faf7f1; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 30 }}>
        <div>
          <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
            Good morning, Dr. Blair
          </h1>
          <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
            {today}&nbsp;&nbsp;·&nbsp;&nbsp;6 patients scheduled&nbsp;&nbsp;·&nbsp;&nbsp;
            <span style={{ color: '#34d399' }}>●</span> Synced 6:02am
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: FAINT, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Est. revenue today</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: GREEN, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>$2,840</p>
          <p style={{ fontSize: 11.5, color: SUB, margin: '3px 0 0' }}>↑ $310 vs avg&nbsp;·&nbsp;$480 leakage flagged</p>
        </div>
      </div>

      {/* Needs attention */}
      <div style={{ marginBottom: 34 }}>
        <SectionLabel meta="4 items">Needs attention today</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {urgentActions.map((a, i) => (
            <Link key={i} href={a.href} style={{ textDecoration: 'none' }}>
              <div className="pc-card" style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 13, height: '100%' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${a.accent}14`, color: a.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.3 }}>{a.title}</p>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: a.accent, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{a.value}</p>
                      <p style={{ fontSize: 10, color: FAINT, margin: 0 }}>{a.valueLabel}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 10px', lineHeight: 1.5 }}>{a.detail}</p>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3f7d6a' }}>{a.cta} →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Practice overview */}
      <div style={{ marginBottom: 34 }}>
        <SectionLabel>Practice overview</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {moduleOverview.map((m, i) => (
            <Link key={i} href={m.href} style={{ textDecoration: 'none' }}>
              <div className="pc-card" style={{ ...card, padding: '16px 18px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: FAINT, display: 'flex' }}>{m.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: SUB }}>{m.label}</span>
                  </div>
                  <Badge label={m.badge.label} variant={m.badge.variant} />
                </div>
                <p style={{ fontSize: 24, fontWeight: 700, color: m.metricColor, margin: '0 0 3px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{m.metric}</p>
                <p style={{ fontSize: 11.5, color: FAINT, margin: '0 0 8px' }}>{m.metricLabel}</p>
                <p style={{ fontSize: 12, color: SUB, margin: 0, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>{m.trend}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Care gaps + revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Top care gap opportunities</span>
            <Badge label="$2,100+ recoverable" variant="green" />
          </div>
          <div>
            {topCareGaps.map((g, i) => (
              <div key={i} className="pc-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < topCareGaps.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: '0 0 2px' }}>{g.patient}</p>
                  <p style={{ fontSize: 12, color: SUB, margin: 0 }}>{g.type}</p>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: '#f0ece3', color: SUB, padding: '2px 7px', borderRadius: 5 }}>{g.code}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: GREEN, minWidth: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.revenue}</span>
                <Badge label={g.priority} variant={g.priority === 'high' ? 'red' : 'amber'} />
              </div>
            ))}
            <div style={{ padding: '11px 18px' }}>
              <Link href="/gaps" style={{ fontSize: 12.5, color: '#3f7d6a', fontWeight: 600, textDecoration: 'none' }}>View all 8 care gaps →</Link>
            </div>
          </div>
        </div>

        <div className="pc-card" style={{ ...card, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Monthly revenue</span>
            <Link href="/analytics" style={{ fontSize: 12.5, color: '#3f7d6a', fontWeight: 600, textDecoration: 'none' }}>Full analytics →</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 104, marginBottom: 12 }}>
            {monthlyRevenue.map((w, i) => {
              const h = (w.v / maxRev) * 92
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: w.projected ? '#34d399' : GREEN, fontVariantNumeric: 'tabular-nums' }}>
                    ${(w.v / 1000).toFixed(0)}k
                  </span>
                  <div style={{ width: '100%', height: h, borderRadius: '5px 5px 0 0', background: w.projected ? 'transparent' : 'linear-gradient(180deg, #57997f, #3f7d6a)', position: 'relative', minHeight: 4 }}>
                    {w.projected && <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #34d399', borderRadius: '5px 5px 0 0' }} />}
                  </div>
                  <span style={{ fontSize: 11, color: w.projected ? '#34d399' : FAINT, fontWeight: w.projected ? 600 : 400 }}>{w.label}</span>
                </div>
              )
            })}
          </div>
          <div style={{ paddingTop: 11, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: SUB }}>DAR: <strong style={{ color: AMBER }}>36 days</strong> · benchmark 32</span>
            <span style={{ fontSize: 12, color: SUB }}>Clean claims: <strong style={{ color: AMBER }}>88%</strong> · benchmark 95%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
