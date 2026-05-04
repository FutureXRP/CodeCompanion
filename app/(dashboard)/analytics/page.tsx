'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'

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
  { payer: 'Medicare',          dar: 28, prev: 31, benchmark: 30, trend: 'up' as const,   volume: '42%', color: '#3b6ef8' },
  { payer: 'Medicaid',          dar: 52, prev: 55, benchmark: 45, trend: 'up' as const,   volume: '18%', color: '#f87171' },
  { payer: 'Blue Cross',        dar: 34, prev: 33, benchmark: 32, trend: 'down' as const, volume: '22%', color: '#fbbf24' },
  { payer: 'United Healthcare', dar: 38, prev: 40, benchmark: 32, trend: 'up' as const,   volume: '11%', color: '#a78bfa' },
  { payer: 'Aetna',             dar: 41, prev: 38, benchmark: 32, trend: 'down' as const, volume: '7%',  color: '#f97316' },
]

const overallDAR = 36
const prevDAR = 39
const benchmarkDAR = 32

const payerMix = [
  { payer: 'Medicare',    pct: 42, prevPct: 40, color: '#3b6ef8' },
  { payer: 'Commercial',  pct: 40, prevPct: 41, color: '#34d399' },
  { payer: 'Medicaid',    pct: 18, prevPct: 19, color: '#fbbf24' },
]

// ── Helpers ───────────────────────────────────────────────────
const maxMonthlyRev = Math.max(...monthlyRevenue.map(m => Math.max(m.actual || 0, m.projected || 0, m.yoy || 0)))
const maxWeeklyRev  = Math.max(...weeklySchedule.map(w => Math.max(w.revenue || 0, w.projected || 0)))

function TrendArrow({ trend, size = 14 }: { trend: 'up' | 'down' | 'neutral'; size?: number }) {
  if (trend === 'up') return <span style={{ color: '#1a7a45', fontSize: `${size}px` }}>↑</span>
  if (trend === 'down') return <span style={{ color: '#c9302c', fontSize: `${size}px` }}>↓</span>
  return <span style={{ color: '#9aa3b2', fontSize: `${size}px` }}>→</span>
}

function Sparkline({ values, color = '#3b6ef8' }: { values: number[]; color?: string }) {
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
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1e2533', margin: '0 0 3px', letterSpacing: '-0.01em' }}>{title}</h2>
      <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{subtitle}</p>
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
    <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Revenue Analytics
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
          Forward projections, operational performance, and year-over-year trends.
        </p>
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          {
            label: 'Projected May revenue',
            value: `$${(projectedMay / 1000).toFixed(1)}k`,
            delta: `+${mayVsYOY}% vs May 2025`,
            deltaType: 'up' as const,
            sub: `vs $${(actualApr / 1000).toFixed(1)}k in April`,
            accent: 'success',
          },
          {
            label: 'Upcoming appointments',
            value: totalUpcoming.toString(),
            delta: 'Next 4 weeks',
            deltaType: 'neutral' as const,
            sub: `~${Math.round(totalUpcoming / 4)} per week`,
            accent: 'default',
          },
          {
            label: 'Overall DAR',
            value: `${overallDAR} days`,
            delta: `↓ ${prevDAR - overallDAR} days vs last month`,
            deltaType: 'up' as const,
            sub: `Benchmark: ${benchmarkDAR} days`,
            accent: overallDAR > benchmarkDAR ? 'warning' : 'success',
          },
          {
            label: 'Clean claim rate',
            value: '88.4%',
            delta: '+3.3pp vs last month',
            deltaType: 'up' as const,
            sub: 'Benchmark: 95.0%',
            accent: 'warning',
          },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: kpi.accent === 'success' ? '#f0faf4' : kpi.accent === 'warning' ? '#fffbf0' : '#fff',
            border: `1px solid ${kpi.accent === 'success' ? '#dcf4e8' : kpi.accent === 'warning' ? '#fef3d0' : '#e4e8ef'}`,
            borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{kpi.label}</p>
            <p style={{ fontSize: '26px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 4px', color: kpi.accent === 'success' ? '#1a7a45' : kpi.accent === 'warning' ? '#b45309' : '#1e2533' }}>{kpi.value}</p>
            <p style={{ fontSize: '12px', fontWeight: '500', color: kpi.deltaType === 'up' ? '#1a7a45' : kpi.deltaType === 'down' ? '#c9302c' : '#9aa3b2', margin: '0 0 2px' }}>{kpi.delta}</p>
            <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533', margin: '0 0 3px' }}>Revenue trend</h2>
            <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>Actual vs projected vs prior year</p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setShowYOY(!showYOY)} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '500', background: showYOY ? '#f0f4ff' : '#f8f9fb', color: showYOY ? '#2d5de8' : '#6b7585', border: `1px solid ${showYOY ? '#dce6ff' : '#e4e8ef'}`, borderRadius: '7px', cursor: 'pointer' }}>
              {showYOY ? '✓ YoY' : 'YoY'}
            </button>
            {(['weekly','monthly'] as const).map(p => (
              <button key={p} onClick={() => setRevPeriod(p)} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '500', background: revPeriod === p ? '#1e2533' : '#f8f9fb', color: revPeriod === p ? '#fff' : '#6b7585', border: '1px solid transparent', borderRadius: '7px', cursor: 'pointer', textTransform: 'capitalize' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          {[
            { color: '#3b6ef8', label: 'Actual revenue', dash: false },
            { color: '#34d399', label: 'Projected', dash: true },
            showYOY && { color: '#e4e8ef', label: 'Prior year', dash: false },
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '3px', background: item.color, borderRadius: '2px', borderTop: item.dash ? '2px dashed' : 'none', opacity: item.dash ? 1 : 1 }} />
              <span style={{ fontSize: '12px', color: '#6b7585' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        {revPeriod === 'monthly' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', padding: '0 4px' }}>
            {monthlyRevenue.map((m, i) => {
              const isProjected = m.actual === null
              const actualH = m.actual ? (m.actual / maxMonthlyRev) * 140 : 0
              const projH = m.projected ? (m.projected / maxMonthlyRev) * 140 : 0
              const yoyH = m.yoy ? (m.yoy / maxMonthlyRev) * 140 : 0
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: '2px', height: '140px' }}>
                    {showYOY && m.yoy && (
                      <div style={{ flex: 1, background: '#f1f3f7', borderRadius: '3px 3px 0 0', height: `${yoyH}px`, minHeight: '2px' }} />
                    )}
                    <div style={{ flex: 1, background: isProjected ? 'transparent' : '#3b6ef8', border: isProjected ? 'none' : 'none', borderRadius: '3px 3px 0 0', height: `${isProjected ? projH : actualH}px`, minHeight: '2px', background: isProjected ? 'repeating-linear-gradient(45deg, #dcf4e8, #dcf4e8 2px, transparent 2px, transparent 6px)' : '#3b6ef8', position: 'relative' }}>
                      {isProjected && <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #34d399', borderRadius: '3px 3px 0 0' }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: '9.5px', color: isProjected ? '#34d399' : '#9aa3b2', fontWeight: isProjected ? '600' : '400', whiteSpace: 'nowrap' }}>{m.month}</span>
                </div>
              )
            })}
          </div>
        )}

        {revPeriod === 'weekly' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', padding: '0 4px' }}>
            {weeklySchedule.map((w, i) => {
              const isProjected = w.revenue === null
              const actualH = w.revenue ? (w.revenue / maxWeeklyRev) * 140 : 0
              const projH = w.projected ? (w.projected / maxWeeklyRev) * 140 : 0
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '100%', height: '140px', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${isProjected ? projH : actualH}px`, minHeight: '2px', borderRadius: '3px 3px 0 0', background: isProjected ? 'transparent' : '#3b6ef8', position: 'relative' }}>
                      {isProjected && <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #34d399', borderRadius: '3px 3px 0 0' }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: '9.5px', color: isProjected ? '#34d399' : '#9aa3b2', fontWeight: isProjected ? '600' : '400', whiteSpace: 'nowrap' }}>{w.week}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Y-axis labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', borderTop: '1px solid #f1f3f7', paddingTop: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9aa3b2' }}>
            {revPeriod === 'monthly' ? `12-month actual avg: $${Math.round(monthlyRevenue.filter(m => m.actual).reduce((s, m) => s + (m.actual || 0), 0) / monthlyRevenue.filter(m => m.actual).length / 1000)}k/mo` : 'Weekly actual vs projected'}
          </span>
          <span style={{ fontSize: '11px', color: '#34d399', fontWeight: '600' }}>
            May projected: ${(projectedMay / 1000).toFixed(1)}k (+{mayVsYOY}% YoY)
          </span>
        </div>
      </div>

      {/* Two column: Operational metrics + DAR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* Operational metrics */}
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
          <SectionTitle title="Operational metrics" subtitle="Your performance vs national primary care benchmarks" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {operationalMetrics.map((m, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: i < operationalMetrics.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#333d4d' }}>{m.label}</span>
                      <span style={{ fontSize: '11px', color: '#9aa3b2' }}>· benchmark {m.benchmark}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: m.trend === 'up' ? '#1a7a45' : '#c9302c' }}>{m.delta}</span>
                  </div>
                  <Sparkline values={m.sparkline} color={m.trend === 'up' ? '#34d399' : '#f87171'} />
                  <div style={{ textAlign: 'right', minWidth: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <TrendArrow trend={m.trend} />
                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#1e2533' }}>{m.value}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#9aa3b2' }}>was {m.prev}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DAR by payer */}
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
          <SectionTitle title="Days in AR by payer" subtitle="Lower is better — benchmark is 30-35 days" />

          {/* Overall DAR */}
          <div style={{ padding: '12px 14px', background: overallDAR > benchmarkDAR ? '#fffbf0' : '#f0faf4', borderRadius: '10px', border: `1px solid ${overallDAR > benchmarkDAR ? '#fef3d0' : '#dcf4e8'}`, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>Overall DAR</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '28px', fontWeight: '700', color: overallDAR > benchmarkDAR ? '#b45309' : '#1a7a45', letterSpacing: '-0.02em' }}>{overallDAR}</span>
                <span style={{ fontSize: '13px', color: '#9aa3b2' }}>days</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#1a7a45', fontWeight: '600', margin: '0 0 2px' }}>↓ {prevDAR - overallDAR} days vs last month</p>
              <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>Benchmark: {benchmarkDAR} days</p>
            </div>
          </div>

          {/* Per-payer DAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {darByPayer.map((p, i) => {
              const pct = Math.min((p.dar / 70) * 100, 100)
              const benchPct = Math.min((p.benchmark / 70) * 100, 100)
              const isOver = p.dar > p.benchmark
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', color: '#333d4d', fontWeight: '500' }}>{p.payer}</span>
                      <span style={{ fontSize: '11px', color: '#9aa3b2' }}>{p.volume}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <TrendArrow trend={p.trend} size={12} />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: isOver ? '#c9302c' : '#1a7a45' }}>{p.dar}d</span>
                      <span style={{ fontSize: '11px', color: '#9aa3b2' }}>was {p.prev}d</span>
                    </div>
                  </div>
                  <div style={{ height: '6px', background: '#f1f3f7', borderRadius: '3px', position: 'relative', overflow: 'visible' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isOver ? '#f87171' : '#34d399', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    <div style={{ position: 'absolute', top: '-2px', left: `${benchPct}%`, width: '2px', height: '10px', background: '#9aa3b2', borderRadius: '1px' }} title={`Benchmark: ${p.benchmark}d`} />
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: '11px', color: '#9aa3b2', margin: '12px 0 0' }}>
            Gray markers = benchmark. Medicaid and Aetna are above target — focus collection efforts here.
          </p>
        </div>
      </div>

      {/* Payer mix + upcoming schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', marginBottom: '24px' }}>

        {/* Payer mix */}
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
          <SectionTitle title="Payer mix" subtitle="Volume distribution — shifts affect DAR and predictability" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {payerMix.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: p.color }} />
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#333d4d' }}>{p.payer}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: p.pct > p.prevPct ? '#1a7a45' : p.pct < p.prevPct ? '#c9302c' : '#9aa3b2' }}>
                      {p.pct > p.prevPct ? '↑' : p.pct < p.prevPct ? '↓' : '→'} was {p.prevPct}%
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e2533' }}>{p.pct}%</span>
                  </div>
                </div>
                <div style={{ height: '8px', background: '#f1f3f7', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f8f9fb', borderRadius: '8px' }}>
            <p style={{ fontSize: '12px', color: '#4a5366', margin: 0, lineHeight: '1.5' }}>
              Medicare mix increasing (+2pp) — positive for DAR predictability. Medicaid decrease (-1pp) helps DAR overall.
            </p>
          </div>
        </div>

        {/* Upcoming schedule */}
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
          <SectionTitle title="Upcoming schedule — next 4 weeks" subtitle={`${totalUpcoming} appointments · $${(projectedMonthRevenue / 1000).toFixed(1)}k projected revenue`} />
          <table style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f3f7' }}>
                {['Week of', 'Scheduled', 'Proj. revenue', 'Avg/visit'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklySchedule.filter(w => w.completed === null).map((w, i, arr) => (
                <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                  <td style={{ padding: '10px 10px', fontWeight: '500', color: '#333d4d' }}>{w.week}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#4a5366' }}>{w.scheduled}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '600', color: '#1a7a45' }}>${((w.projected || 0) / 1000).toFixed(1)}k</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#6b7585' }}>${Math.round((w.projected || 0) / w.scheduled)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #e4e8ef', background: '#f8f9fb' }}>
                <td style={{ padding: '10px 10px', fontWeight: '600', color: '#1e2533' }}>Total</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '600', color: '#1e2533' }}>{totalUpcoming}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#1a7a45' }}>${(projectedMonthRevenue / 1000).toFixed(1)}k</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '600', color: '#1e2533' }}>${Math.round(projectedMonthRevenue / totalUpcoming)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid #dce6ff' }}>
            <p style={{ fontSize: '12px', color: '#2d5de8', margin: 0, lineHeight: '1.5' }}>
              <strong>Projection basis:</strong> Scheduled appointments × average allowed by payer mix × (1 − 7.2% no-show rate) + expected care gap revenue.
              Actuals will vary based on coding accuracy and payer adjudication.
            </p>
          </div>
        </div>
      </div>

      {/* Insight callout */}
      <div style={{ background: '#1e2533', borderRadius: '14px', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b6ef8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2a7 7 0 100 14A7 7 0 009 2zM9 6v4M9 12v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 6px' }}>Revenue opportunity summary</p>
          <p style={{ fontSize: '13px', color: '#9aa3b2', margin: '0 0 10px', lineHeight: '1.6' }}>
            Based on current dynamics, your May projected revenue of <strong style={{ color: '#34d399' }}>${(projectedMay / 1000).toFixed(1)}k</strong> is {mayVsYOY}% above May 2025.
            Closing the 3 coding leakage flags adds ~<strong style={{ color: '#34d399' }}>$310</strong> to this week alone.
            Improving clean claim rate from 88% to the 95% benchmark would recover an estimated <strong style={{ color: '#34d399' }}>$2,800/month</strong> in currently denied claims.
            Reducing DAR from {overallDAR} to {benchmarkDAR} days accelerates approximately <strong style={{ color: '#34d399' }}>$14,000</strong> in cash flow into this quarter.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/coding" style={{ padding: '7px 14px', background: '#3b6ef8', color: '#fff', fontSize: '12.5px', fontWeight: '500', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>Review coding flags</a>
            <a href="/pulse" style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '12.5px', fontWeight: '500', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>View Practice Pulse</a>
          </div>
        </div>
      </div>

    </div>
  )
}
