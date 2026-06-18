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

const levelColor = { high: RED,   medium: AMBER, low: GREEN }
const levelBadge = { high: 'red', medium: 'amber', low: 'green' } as const

const highRisk  = appointments.filter(a => a.level === 'high').length
const medRisk   = appointments.filter(a => a.level === 'medium').length
const avgNoShow = Math.round(appointments.reduce((s, a) => s + a.noShowPct, 0) / appointments.length)

export default function SchedulePage() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #d9e0ea; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Schedule risk
        </h1>
        <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>{today} · {appointments.length} appointments</p>
      </div>

      {/* Summary KPIs — white cards, color only on numbers/icons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 34 }}>
        {[
          {
            label: 'High risk slots', value: `${highRisk}`, sub: 'Recommend action',
            numColor: AMBER, accent: AMBER,
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
          },
          {
            label: 'Medium risk slots', value: `${medRisk}`, sub: 'Monitor closely',
            numColor: INK, accent: '#5a6473',
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
          },
          {
            label: 'Avg no-show risk', value: `${avgNoShow}%`, sub: "Across today's schedule",
            numColor: INK, accent: '#5a6473',
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
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

      {/* Schedule */}
      <SectionLabel meta={`${appointments.length} appointments`}>Today's schedule</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {appointments.map((a, i) => (
          <div key={i} className="pc-card" style={card}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>

              {/* Time */}
              <div style={{ width: 70, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: 0 }}>{a.time}</p>
                <p style={{ fontSize: 11, color: FAINT, margin: '2px 0 0' }}>{a.type}</p>
              </div>

              {/* Patient info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{a.patient}</span>
                  <span style={{ fontSize: 12, color: FAINT }}>Age {a.age} · {a.insurance}</span>
                  <Badge label={a.level === 'high' ? 'High risk' : a.level === 'medium' ? 'Medium risk' : 'Low risk'} variant={levelBadge[a.level]} />
                </div>

                {/* History pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: a.level !== 'low' ? 10 : 0 }}>
                  <span style={{ fontSize: 11, background: '#f3f5f9', color: SUB, padding: '2px 8px', borderRadius: 99 }}>
                    {a.history.noShows}/{a.history.total} no-shows
                  </span>
                  <span style={{ fontSize: 11, background: '#f3f5f9', color: SUB, padding: '2px 8px', borderRadius: 99 }}>
                    Last visit: {a.history.lastVisit}
                  </span>
                  <span style={{ fontSize: 11, background: a.history.lastStatus === 'No Show' ? `${AMBER}12` : `${GREEN}12`, color: a.history.lastStatus === 'No Show' ? AMBER : GREEN, padding: '2px 8px', borderRadius: 99 }}>
                    Last: {a.history.lastStatus}
                  </span>
                </div>

                {/* Risk factors & recommendation (high/medium only) */}
                {a.level !== 'low' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '8px 12px', background: '#f8f9fb', borderRadius: 9, border: `1px solid ${LINE}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>Risk factors</p>
                      {a.factors.map((f, j) => (
                        <p key={j} style={{ fontSize: 12, color: SUB, margin: j < a.factors.length - 1 ? '0 0 2px' : 0 }}>• {f}</p>
                      ))}
                    </div>
                    <div style={{ padding: '8px 12px', background: '#f5f8ff', borderRadius: 9, border: '1px solid #dce6ff' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>Recommendation</p>
                      <p style={{ fontSize: 12, color: SUB, margin: 0, lineHeight: 1.5 }}>{a.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk gauge */}
              <div style={{ textAlign: 'center', flexShrink: 0, width: 64 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: `conic-gradient(${levelColor[a.level]} ${a.noShowPct * 3.6}deg, #f1f3f7 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 4px',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: levelColor[a.level], fontVariantNumeric: 'tabular-nums',
                  }}>
                    {a.noShowPct}%
                  </div>
                </div>
                <p style={{ fontSize: 10, color: FAINT, margin: 0 }}>no-show</p>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Waitlist tip */}
      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: '#f5f8ff', borderRadius: 12, border: '1px solid #dce6ff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#3b6ef8" strokeWidth="1.5"/>
          <path d="M8 5v3.5l2 1.5" stroke="#3b6ef8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: 12.5, color: SUB, margin: 0 }}>
          <strong style={{ color: '#2d5de8' }}>Tip:</strong> The 10:00 AM and 11:30 AM slots are high risk. Consider maintaining a 2-patient same-day waitlist to fill gaps if either no-shows.
        </p>
      </div>

    </div>
  )
}
