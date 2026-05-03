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
