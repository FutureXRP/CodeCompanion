'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'

// ── Palette ───────────────────────────────────────────────────
const INK   = '#1f2d27'
const SUB   = '#65726b'
const FAINT = '#9aa69f'
const LINE  = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const RED   = '#cf5547'

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

// ── Mock data ─────────────────────────────────────────────────

const weeklySchedule = [
  { week: 'Apr 7',  scheduled: 94, completed: 88, noShows: 6,  revenue: 14920, projected: 15800 },
  { week: 'Apr 14', scheduled: 98, completed: 91, noShows: 7,  revenue: 15470, projected: 16200 },
  { week: 'Apr 21', scheduled: 102, completed: 94, noShows: 8, revenue: 15990, projected: 16800 },
  { week: 'Apr 28', scheduled: 96, completed: 90, noShows: 6,  revenue: 15300, projected: 15900 },
  { week: 'May 5',  scheduled: 104, completed: null, noShows: null, revenue: null, projected: 17200 },
  { week: 'May 12', scheduled: 101, completed: null, noShows: null, revenue: null, projected: 16700 },
  { week: 'May 19', scheduled: 98,  completed: null, noShows: null, revenue: null, projected: 16200 },
  { week: 'May 26', scheduled: 95,  completed: null, noShows: null, revenue: null, projected: 15700 },
]

const monthlyRevenue = [
  { month: 'Jun 25',  actual: 48200, projected: 47000, yoy: 42100 },
  { month: 'Jul 25',  actual: 46100, projected: 46500, yoy: 41200 },
  { month: 'Aug 25',  actual: 49800, projected: 48000, yoy: 43800 },
  { month: 'Sep 25',  actual: 51200, projected: 50000, yoy: 44900 },
  { month: 'Oct 25',  actual: 50600, projected: 50500, yoy: 45200 },
  { month: 'Nov 25',  actual: 47300, projected: 49000, yoy: 43100 },
  { month: 'Dec 25',  actual: 44100, projected: 45000, yoy: 40200 },
  { month: 'Jan 26',  actual: 45800, projected: 46000, yoy: 41500 },
  { month: 'Feb 26',  actual: 50100, projected: 49500, yoy: 44800 },
  { month: 'Mar 26',  actual: 52400, projected: 51000, yoy: 46100 },
  { month: 'Apr 26',  actual: 53100, projected: 52000, yoy: 46900 },
  { month: 'May 26',  actual: null,  projected: 65800, yoy: 47200 },
]

const operationalMetrics = [
  {
    label: 'Same-day closure rate',
    value: '78%',
    prev: '71%',
    benchmark: '85%',
    trend: 'up' as const,
    delta: '+7pp vs last month',
    sparkline: [65, 68, 71, 69, 72, 74, 71, 75, 76, 78],
    description: 'Encounters coded same day as visit',
    insight: 'Improving but still below benchmark. CodeCompanion coding suggestions should push this to 90%+ once live.',
  },
  {
    label: 'Time to code',
    value: '2.4 days',
    prev: '3.8 days',
    benchmark: '1.0 days',
    trend: 'up' as const,
    delta: '-1.4 days vs last month',
    sparkline: [5.2, 4.8, 4.1, 4.4, 3.9, 3.8, 3.6, 3.2, 2.8, 2.4],
    description: 'Average days from visit to codes submitted',
    insight: 'Significant improvement. Target is same-day with AI coding suggestions.',
  },
  {
    label: 'Time to bill',
    value: '1.2 days',
    prev: '1.4 days',
    benchmark: '1.0 days',
    trend: 'up' as const,
    delta: '-0.2 days vs last month',
    sparkline: [2.1, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.4, 1.3, 1.2],
    description: 'Average days from coding to claim submission',
    insight: 'Near benchmark. Athena auto-billing is performing well here.',
  },
  {
    label: 'Clean claim rate',
    value: '88.4%',
    prev: '85.1%',
    benchmark: '95.0%',
    trend: 'up' as const,
    delta: '+3.3pp vs last month',
    sparkline: [82, 83, 84, 83, 85, 84, 85, 86, 87, 88.4],
    description: 'Claims accepted first-pass without rejection',
    insight: 'Improving but 6.6pp below benchmark. Denial pattern in Practice Pulse (CO-97) is suppressing this.',
  },
  {
    label: 'Collection rate',
    value: '94.2%',
    prev: '93.1%',
    benchmark: '96.0%',
    trend: 'up' as const,
    delta: '+1.1pp vs last month',
    sparkline: [91, 91.5, 92, 91.8, 92.5, 93, 92.8, 93.1, 93.8, 94.2],
    description: 'Percentage of charges ultimately collected',
    insight: 'Strong and improving. Closing care gaps and reducing denials will push this further.',
  },
  {
    label: 'No-show rate',
    value: '7.2%',
    prev: '8.9%',
    benchmark: '6.0%',
    trend: 'up' as const,
    delta: '-1.7pp vs last month',
    sparkline: [11, 10.5, 10, 9.8, 9.2, 8.9, 8.5, 8.1, 7.8, 7.2],
    description: 'Percentage of scheduled appointments missed',
    insight: 'Good improvement trend. Still slightly above benchmark. Schedule risk alerts helping.',
  },
]

const darByPayer = [
  { payer: 'Medicare',          dar: 28, prev: 31, benchmark: 30, trend: 'up' as const,   volume: '42%', color: '#57997f' },
  { payer: 'Medicaid',          dar: 52, prev: 55, benchmark: 45, trend: 'up' as const,   volume: '18%', color: '#f87171' },
  { payer: 'Blue Cross',        dar: 34, prev: 33, benchmark: 32, trend: 'down' as const, volume: '22%', color: '#fbbf24' },
  { payer: 'United Healthcare', dar: 38, prev: 40, benchmark: 32, trend: 'up' as const,   volume: '11%', color: '#a78bfa' },
  { payer: 'Aetna',             dar: 41, prev: 38, benchmark: 32, trend: 'down' as const, volume: '7%',  color: '#f97316' },
]

const overallDAR = 36
const prevDAR = 39
const benchmarkDAR = 32

const payerMix = [
  { payer: 'Medicare',    pct: 42, prevPct: 40, color: '#57997f' },
  { payer: 'Commercial',  pct: 40, prevPct: 41, color: '#34d399' },
  { payer: 'Medicaid',    pct: 18, prevPct: 19, color: '#fbbf24' },
]

// ── Helpers ───────────────────────────────────────────────────
const maxMonthlyRev = Math.max(...monthlyRevenue.map(m => Math.max(m.actual || 0, m.projected || 0, m.yoy || 0)))
const maxWeeklyRev  = Math.max(...weeklySchedule.map(w => Math.max(w.revenue || 0, w.projected || 0)))

function TrendArrow({ trend, size = 14 }: { trend: 'up' | 'down' | 'neutral'; size?: number }) {
  if (trend === 'up') return <span style={{ color: GREEN, fontSize: `${size}px` }}>↑</span>
  if (trend === 'down') return <span style={{ color: RED, fontSize: `${size}px` }}>↓</span>
  return <span style={{ color: FAINT, fontSize: `${size}px` }}>→</span>
}

function Sparkline({ values, color = '#57997f' }: { values: number[]; color?: string }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const w = 80, h = 28, pad = 2
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points.split(' ').pop()!.split(',')[0]} cy={points.split(' ').pop()!.split(',')[1]} r="2.5" fill={color} />
    </svg>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: INK, margin: '0 0 3px', letterSpacing: '-0.01em' }}>{title}</h2>
      <p style={{ fontSize: 12, color: FAINT, margin: 0 }}>{subtitle}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [revPeriod, setRevPeriod] = useState<'weekly' | 'monthly'>('monthly')
  const [showYOY, setShowYOY] = useState(true)

  const projectedMay = monthlyRevenue.find(m => m.month === 'May 26')?.projected || 0
  const actualApr    = monthlyRevenue.find(m => m.month === 'Apr 26')?.actual || 0
  const yoyMay       = monthlyRevenue.find(m => m.month === 'May 26')?.yoy || 0
  const mayVsYOY     = Math.round(((projectedMay - yoyMay) / yoyMay) * 100)

  const upcomingAppts = weeklySchedule.filter(w => w.completed === null)
  const totalUpcoming = upcomingAppts.reduce((s, w) => s + w.scheduled, 0)
  const projectedMonthRevenue = upcomingAppts.reduce((s, w) => s + (w.projected || 0), 0)

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #ddd6c8; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Revenue Analytics
        </h1>
        <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
          Forward projections, operational performance, and year-over-year trends.
        </p>
      </div>

      {/* Top KPIs — white cards, color only on numbers/icons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 34 }}>
        {[
          {
            label: 'Projected May revenue',
            value: `$${(projectedMay / 1000).toFixed(1)}k`,
            delta: `+${mayVsYOY}% vs May 2025`,
            deltaColor: GREEN,
            sub: `vs $${(actualApr / 1000).toFixed(1)}k in April`,
            numColor: GREEN,
            accent: GREEN,
          },
          {
            label: 'Upcoming appointments',
            value: totalUpcoming.toString(),
            delta: 'Next 4 weeks',
            deltaColor: FAINT,
            sub: `~${Math.round(totalUpcoming / 4)} per week`,
            numColor: INK,
            accent: '#65726b',
          },
          {
            label: 'Overall DAR',
            value: `${overallDAR} days`,
            delta: `↓ ${prevDAR - overallDAR} days vs last month`,
            deltaColor: GREEN,
            sub: `Benchmark: ${benchmarkDAR} days`,
            numColor: AMBER,
            accent: AMBER,
          },
          {
            label: 'Clean claim rate',
            value: '88.4%',
            delta: '+3.3pp vs last month',
            deltaColor: GREEN,
            sub: 'Benchmark: 95.0%',
            numColor: AMBER,
            accent: AMBER,
          },
        ].map((kpi, i) => (
          <div key={i} className="pc-card" style={card}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${kpi.accent}14`, color: kpi.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>$</span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{kpi.label}</p>
              </div>
              <p style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px', color: kpi.numColor, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: kpi.deltaColor, margin: '0 0 2px' }}>{kpi.delta}</p>
              <p style={{ fontSize: 11, color: FAINT, margin: 0 }}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ marginBottom: 34 }}>
        <SectionLabel>Revenue trend</SectionLabel>
        <div className="pc-card" style={{ ...card, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: INK, margin: '0 0 3px' }}>Revenue trend</h2>
              <p style={{ fontSize: 12, color: FAINT, margin: 0 }}>Actual vs projected vs prior year</p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setShowYOY(!showYOY)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: showYOY ? '#eef3f0' : '#f7f5f0', color: showYOY ? '#3f7d6a' : SUB, border: `1px solid ${showYOY ? '#e6efe9' : LINE}`, borderRadius: 7, cursor: 'pointer' }}>
                {showYOY ? '✓ YoY' : 'YoY'}
              </button>
              {(['weekly','monthly'] as const).map(p => (
                <button key={p} onClick={() => setRevPeriod(p)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: revPeriod === p ? INK : '#f7f5f0', color: revPeriod === p ? '#fff' : SUB, border: '1px solid transparent', borderRadius: 7, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[
              { color: '#57997f', label: 'Actual revenue', dash: false },
              { color: '#34d399', label: 'Projected', dash: true },
              showYOY && { color: LINE, label: 'Prior year', dash: false },
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 3, background: item.color, borderRadius: 2, borderTop: item.dash ? '2px dashed' : 'none', opacity: item.dash ? 1 : 1 }} />
                <span style={{ fontSize: 12, color: SUB }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {revPeriod === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 4px' }}>
              {monthlyRevenue.map((m, i) => {
                const isProjected = m.actual === null
                const actualH = m.actual ? (m.actual / maxMonthlyRev) * 140 : 0
                const projH = m.projected ? (m.projected / maxMonthlyRev) * 140 : 0
                const yoyH = m.yoy ? (m.yoy / maxMonthlyRev) * 140 : 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
                      {showYOY && m.yoy && (
                        <div style={{ flex: 1, background: '#f0ece3', borderRadius: '3px 3px 0 0', height: `${yoyH}px`, minHeight: 2 }} />
                      )}
                      <div style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${isProjected ? projH : actualH}px`, minHeight: 2, background: isProjected ? 'repeating-linear-gradient(45deg, #e6f4ec, #e6f4ec 2px, transparent 2px, transparent 6px)' : '#57997f', position: 'relative' }}>
                        {isProjected && <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #34d399', borderRadius: '3px 3px 0 0' }} />}
                      </div>
                    </div>
                    <span style={{ fontSize: 9.5, color: isProjected ? '#34d399' : FAINT, fontWeight: isProjected ? 600 : 400, whiteSpace: 'nowrap' }}>{m.month}</span>
                  </div>
                )
              })}
            </div>
          )}

          {revPeriod === 'weekly' && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 4px' }}>
              {weeklySchedule.map((w, i) => {
                const isProjected = w.revenue === null
                const actualH = w.revenue ? (w.revenue / maxWeeklyRev) * 140 : 0
                const projH = w.projected ? (w.projected / maxWeeklyRev) * 140 : 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${isProjected ? projH : actualH}px`, minHeight: 2, borderRadius: '3px 3px 0 0', background: isProjected ? 'transparent' : '#57997f', position: 'relative' }}>
                        {isProjected && <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #34d399', borderRadius: '3px 3px 0 0' }} />}
                      </div>
                    </div>
                    <span style={{ fontSize: 9.5, color: isProjected ? '#34d399' : FAINT, fontWeight: isProjected ? 600 : 400, whiteSpace: 'nowrap' }}>{w.week}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Y-axis labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: `1px solid ${LINE}`, paddingTop: 8 }}>
            <span style={{ fontSize: 11, color: FAINT }}>
              {revPeriod === 'monthly' ? `12-month actual avg: $${Math.round(monthlyRevenue.filter(m => m.actual).reduce((s, m) => s + (m.actual || 0), 0) / monthlyRevenue.filter(m => m.actual).length / 1000)}k/mo` : 'Weekly actual vs projected'}
            </span>
            <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>
              May projected: ${(projectedMay / 1000).toFixed(1)}k (+{mayVsYOY}% YoY)
            </span>
          </div>
        </div>
      </div>

      {/* Two column: Operational metrics + DAR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 34 }}>
        <SectionLabel>Performance</SectionLabel>
        <SectionLabel>Days in AR</SectionLabel>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 34, marginTop: -20 }}>

        {/* Operational metrics */}
        <div className="pc-card" style={{ ...card, padding: '20px 24px' }}>
          <SectionTitle title="Operational metrics" subtitle="Your performance vs national primary care benchmarks" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {operationalMetrics.map((m, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: i < operationalMetrics.length - 1 ? `1px solid #f7f5f0` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: FAINT }}>· benchmark {m.benchmark}</span>
                    </div>
                    <span style={{ fontSize: 11, color: m.trend === 'up' ? GREEN : RED }}>{m.delta}</span>
                  </div>
                  <Sparkline values={m.sparkline} color={m.trend === 'up' ? '#34d399' : '#f87171'} />
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <TrendArrow trend={m.trend} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                    </div>
                    <span style={{ fontSize: 11, color: FAINT }}>was {m.prev}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DAR by payer */}
        <div className="pc-card" style={{ ...card, padding: '20px 24px' }}>
          <SectionTitle title="Days in AR by payer" subtitle="Lower is better — benchmark is 30-35 days" />

          {/* Overall DAR */}
          <div style={{ padding: '12px 14px', background: overallDAR > benchmarkDAR ? `${AMBER}09` : `${GREEN}09`, borderRadius: 10, border: `1px solid ${overallDAR > benchmarkDAR ? `${AMBER}28` : `${GREEN}28`}`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>Overall DAR</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: overallDAR > benchmarkDAR ? AMBER : GREEN, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{overallDAR}</span>
                <span style={{ fontSize: 13, color: FAINT }}>days</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: GREEN, fontWeight: 600, margin: '0 0 2px' }}>↓ {prevDAR - overallDAR} days vs last month</p>
              <p style={{ fontSize: 11, color: FAINT, margin: 0 }}>Benchmark: {benchmarkDAR} days</p>
            </div>
          </div>

          {/* Per-payer DAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {darByPayer.map((p, i) => {
              const pct = Math.min((p.dar / 70) * 100, 100)
              const benchPct = Math.min((p.benchmark / 70) * 100, 100)
              const isOver = p.dar > p.benchmark
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: INK, fontWeight: 500 }}>{p.payer}</span>
                      <span style={{ fontSize: 11, color: FAINT }}>{p.volume}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <TrendArrow trend={p.trend} size={12} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isOver ? AMBER : GREEN, fontVariantNumeric: 'tabular-nums' }}>{p.dar}d</span>
                      <span style={{ fontSize: 11, color: FAINT }}>was {p.prev}d</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#f0ece3', borderRadius: 3, position: 'relative', overflow: 'visible' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isOver ? '#f87171' : '#34d399', borderRadius: 3, transition: 'width 0.5s ease' }} />
                    <div style={{ position: 'absolute', top: -2, left: `${benchPct}%`, width: 2, height: 10, background: FAINT, borderRadius: 1 }} title={`Benchmark: ${p.benchmark}d`} />
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: 11, color: FAINT, margin: '12px 0 0' }}>
            Gray markers = benchmark. Medicaid and Aetna are above target — focus collection efforts here.
          </p>
        </div>
      </div>

      {/* Payer mix + upcoming schedule */}
      <SectionLabel>Mix & schedule</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16, marginBottom: 34 }}>

        {/* Payer mix */}
        <div className="pc-card" style={{ ...card, padding: '20px 24px' }}>
          <SectionTitle title="Payer mix" subtitle="Volume distribution — shifts affect DAR and predictability" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {payerMix.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>{p.payer}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: p.pct > p.prevPct ? GREEN : p.pct < p.prevPct ? RED : FAINT }}>
                      {p.pct > p.prevPct ? '↑' : p.pct < p.prevPct ? '↓' : '→'} was {p.prevPct}%
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{p.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 8, background: '#f0ece3', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: '#f7f5f0', borderRadius: 9, border: `1px solid ${LINE}` }}>
            <p style={{ fontSize: 12, color: SUB, margin: 0, lineHeight: 1.5 }}>
              Medicare mix increasing (+2pp) — positive for DAR predictability. Medicaid decrease (-1pp) helps DAR overall.
            </p>
          </div>
        </div>

        {/* Upcoming schedule */}
        <div className="pc-card" style={{ ...card, padding: '20px 24px' }}>
          <SectionTitle title="Upcoming schedule — next 4 weeks" subtitle={`${totalUpcoming} appointments · $${(projectedMonthRevenue / 1000).toFixed(1)}k projected revenue`} />
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                {['Week of', 'Scheduled', 'Proj. revenue', 'Avg/visit'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklySchedule.filter(w => w.completed === null).map((w, i, arr) => (
                <tr key={i} style={{ borderBottom: i < arr.length - 1 ? `1px solid #f7f5f0` : 'none' }}>
                  <td style={{ padding: '10px 10px', fontWeight: 500, color: INK }}>{w.week}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{w.scheduled}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>${((w.projected || 0) / 1000).toFixed(1)}k</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>${Math.round((w.projected || 0) / w.scheduled)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${LINE}`, background: '#faf7f1' }}>
                <td style={{ padding: '10px 10px', fontWeight: 600, color: INK }}>Total</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{totalUpcoming}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>${(projectedMonthRevenue / 1000).toFixed(1)}k</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>${Math.round(projectedMonthRevenue / totalUpcoming)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 14, padding: '10px 12px', background: '#eef3f0', borderRadius: 9, border: '1px solid #e6efe9' }}>
            <p style={{ fontSize: 12, color: SUB, margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: '#3f7d6a' }}>Projection basis:</strong> Scheduled appointments × average allowed by payer mix × (1 − 7.2% no-show rate) + expected care gap revenue.
              Actuals will vary based on coding accuracy and payer adjudication.
            </p>
          </div>
        </div>
      </div>

      {/* Insight callout */}
      <div style={{ background: INK, borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#57997f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2a7 7 0 100 14A7 7 0 009 2zM9 6v4M9 12v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>Revenue opportunity summary</p>
          <p style={{ fontSize: 13, color: '#9aa69f', margin: '0 0 10px', lineHeight: 1.6 }}>
            Based on current dynamics, your May projected revenue of <strong style={{ color: '#34d399' }}>${(projectedMay / 1000).toFixed(1)}k</strong> is {mayVsYOY}% above May 2025.
            Closing the 3 coding leakage flags adds ~<strong style={{ color: '#34d399' }}>$310</strong> to this week alone.
            Improving clean claim rate from 88% to the 95% benchmark would recover an estimated <strong style={{ color: '#34d399' }}>$2,800/month</strong> in currently denied claims.
            Reducing DAR from {overallDAR} to {benchmarkDAR} days accelerates approximately <strong style={{ color: '#34d399' }}>$14,000</strong> in cash flow into this quarter.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/coding" style={{ padding: '7px 14px', background: '#57997f', color: '#fff', fontSize: 12.5, fontWeight: 500, borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>Review coding flags</a>
            <a href="/pulse" style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12.5, fontWeight: 500, borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>View Practice Pulse</a>
          </div>
        </div>
      </div>

    </div>
  )
}
