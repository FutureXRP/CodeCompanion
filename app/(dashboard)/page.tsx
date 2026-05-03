import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const codingFlags = [
  { patient: 'R. Okonkwo',  billed: '99213', suggested: '99214', delta: '+$68',  confidence: 94 },
  { patient: 'D. Patel',    billed: '99213', suggested: '99214', delta: '+$68',  confidence: 91 },
  { patient: 'M. Castillo', billed: '99215', suggested: 'G0439', delta: '+$174', confidence: 88 },
]

const careGaps = [
  { patient: 'M. Castillo', type: 'Annual Wellness Visit', code: 'G0439', revenue: '$174',     priority: 'high'   as const },
  { patient: 'R. Okonkwo',  type: 'CCM Enrollment',       code: '99490', revenue: '+$62/mo',  priority: 'high'   as const },
  { patient: 'D. Patel',    type: 'HbA1c overdue',        code: 'lab',   revenue: 'recall',   priority: 'medium' as const },
  { patient: '4 patients',  type: 'Depression screening', code: 'G0444', revenue: '$44 each', priority: 'medium' as const },
]

const scheduleRisks = [
  { time: '10:00a', patient: 'B. Nwosu',     risk: 82, level: 'high'  as const },
  { time: '11:30a', patient: 'T. Larsson',   risk: 71, level: 'amber' as const },
  { time: '2:00p',  patient: 'F. Adeola',    risk: 22, level: 'low'   as const },
  { time: '3:15p',  patient: 'C. Dimitriou', risk: 15, level: 'low'   as const },
]

const riskTrack = { high: '#f87171', amber: '#fbbf24', low: '#34d399' }
const riskBadge = { high: 'red', amber: 'amber', low: 'green' } as const

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: 0, letterSpacing: '-0.02em' }}>
          Good morning, Dr. Blair
        </h1>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: '4px 0 0' }}>
          {today} &nbsp;·&nbsp; 6 patients scheduled &nbsp;·&nbsp;
          <span style={{ color: '#34d399' }}>●</span> Last synced 6:02am
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Est. revenue today" value="$2,840" delta="↑ $310 vs avg" deltaType="up" />
        <StatCard label="Coding leakage" value="$480" delta="3 encounters flagged" deltaType="down" accent="warning" />
        <StatCard label="Care gaps open" value="14" delta="$2,100 recoverable" deltaType="neutral" />
        <StatCard label="No-show risk" value="2 slots" delta="High confidence" deltaType="down" accent="danger" />
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Coding suggestions */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Coding suggestions</span>
            <Badge label="3 pending" variant="amber" />
          </CardHeader>
          <CardBody className="p-0">
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f3f7' }}>
                  {['Patient', 'Billed', 'Suggested', 'Delta'].map((h, i) => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: i === 3 ? 'right' : 'left',
                      fontSize: '11px', fontWeight: '600', color: '#9aa3b2',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codingFlags.map((f, i) => (
                  <tr key={i} style={{ borderBottom: i < 2 ? '1px solid #f8f9fb' : 'none' }}>
                    <td style={{ padding: '11px 16px', fontWeight: '500', color: '#1e2533' }}>{f.patient}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '2px 8px', borderRadius: '4px' }}>{f.billed}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f0faf4', color: '#1a7a45', padding: '2px 8px', borderRadius: '4px' }}>{f.suggested}</span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '600', color: '#1a7a45' }}>{f.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f3f7' }}>
              <a href="/coding" style={{ fontSize: '12px', color: '#3b6ef8', textDecoration: 'none', fontWeight: '500' }}>
                Review &amp; approve all →
              </a>
            </div>
          </CardBody>
        </Card>

        {/* Schedule risk */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Schedule risk — today</span>
            <Badge label="2 high risk" variant="red" />
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {scheduleRisks.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#9aa3b2', width: '44px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{s.time}</span>
                  <span style={{ fontSize: '13px', color: '#333d4d', flex: 1 }}>{s.patient}</span>
                  <div style={{ width: '80px', height: '4px', background: '#f1f3f7', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: riskTrack[s.level], borderRadius: '2px', width: `${s.risk}%`, transition: 'width 0.6s ease' }} />
                  </div>
                  <Badge label={`${s.risk}%`} variant={riskBadge[s.level]} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Care gaps */}
      <Card style={{ marginBottom: '16px' }}>
        <CardHeader>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e2533' }}>Care gap opportunities</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1a7a45' }}>$2,100–$3,400 recoverable</span>
            <Badge label="14 patients" variant="blue" />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <table style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f3f7' }}>
                {['Patient', 'Gap', 'Code', 'Revenue', 'Priority'].map(h => (
                  <th key={h} style={{
                    padding: '9px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: '600', color: '#9aa3b2',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {careGaps.map((g, i) => (
                <tr key={i} style={{ borderBottom: i < careGaps.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                  <td style={{ padding: '11px 16px', fontWeight: '500', color: '#1e2533' }}>{g.patient}</td>
                  <td style={{ padding: '11px 16px', color: '#4a5366' }}>{g.type}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '2px 8px', borderRadius: '4px' }}>{g.code}</span>
                  </td>
                  <td style={{ padding: '11px 16px', fontWeight: '600', color: '#1a7a45' }}>{g.revenue}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge label={g.priority} variant={g.priority === 'high' ? 'red' : 'amber'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f3f7' }}>
            <a href="/gaps" style={{ fontSize: '12px', color: '#3b6ef8', textDecoration: 'none', fontWeight: '500' }}>View all care gaps →</a>
          </div>
        </CardBody>
      </Card>

      {/* Audit alert */}
      <div style={{
        background: '#fff5f5', border: '1px solid #ffe0e0',
        borderRadius: '12px', padding: '14px 18px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path d="M9 1L1 16h16L9 1z" stroke="#c9302c" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 7v4M9 13.5v.5" stroke="#c9302c" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#c9302c', margin: '0 0 3px' }}>Audit shield — 2 active flags</p>
          <p style={{ fontSize: '12px', color: '#a32522', margin: 0, lineHeight: '1.5' }}>
            Your 99215 rate (31%) exceeds the RAC watch threshold (25%). 2 encounter notes are missing explicit MDM documentation.
          </p>
          <a href="/audit" style={{ fontSize: '12px', color: '#c9302c', fontWeight: '500', textDecoration: 'underline', display: 'inline-block', marginTop: '6px' }}>
            Review audit risks →
          </a>
        </div>
      </div>

    </div>
  )
}
