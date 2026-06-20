import Link from 'next/link'
import { formatCents } from '@/lib/canonical'
import { sampleArBook, buildArAging, buildDenialAnalytics } from '@/lib/analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const RED = '#cf5547'
const BLUE = '#3f7d6a' // sage primary

const DAR_BENCHMARK = 35
const BUCKET_COLORS = ['#3f7d6a', '#7e9a4e', '#b8862a', '#c9744b', '#cf5547']

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function SectionLabel({ children, meta }: { children: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</span>
      <div style={{ height: 1, flex: 1, background: LINE }} />
      {meta && <span style={{ fontSize: 11.5, color: FAINT }}>{meta}</span>}
    </div>
  )
}

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="pc-card" style={{ ...card, padding: '15px 17px' }}>
      <p style={{ fontSize: 11, color: FAINT, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? INK, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: SUB, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: FAINT, padding: '8px 14px', borderBottom: `1px solid ${LINE}`, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { fontSize: 12.5, color: INK, padding: '9px 14px', borderBottom: `1px solid #f0ece3`, verticalAlign: 'middle' }

export default function AgingPage() {
  const book = sampleArBook()
  const aging = buildArAging(book.receivables, { asOf: book.asOf, avgDailyChargeCents: book.avgDailyChargeCents })
  const denials = buildDenialAnalytics(book.denials, book.totalClaims)
  const darOver = aging.darDays > DAR_BENCHMARK

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1180, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #ddd6c8; }
        .pc-row:hover { background: #faf7f1; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 26 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: 0, letterSpacing: '-0.025em' }}>A/R &amp; Denials</h1>
            <span style={{ fontSize: 11, fontWeight: 600, color: GREEN, background: '#e6f4ec', padding: '3px 10px', borderRadius: 999 }}>Synthetic A/R book</span>
          </div>
          <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
            Outstanding receivables aged by service date, and where claims are being denied. {aging.totals.count} open claims · {denials.deniedCount} denials in period.
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: FAINT, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Recoverable via appeal</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: GREEN, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatCents(denials.appealableCents)}</p>
          <p style={{ fontSize: 11.5, color: SUB, margin: '3px 0 0' }}>{denials.appealableCount} appealable denials of {formatCents(denials.totalDeniedCents)}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 30 }}>
        <Kpi label="Total A/R" value={formatCents(aging.totals.totalCents)} sub={`${formatCents(aging.totals.insuranceArCents)} ins · ${formatCents(aging.totals.patientArCents)} pat`} />
        <Kpi label="Over 90 days" value={formatCents(aging.totals.over90Cents)} accent={aging.over90Pct > 0.15 ? AMBER : GREEN} sub={`${pct(aging.over90Pct)} of A/R`} />
        <Kpi label="Days in A/R" value={`${aging.darDays}d`} accent={darOver ? AMBER : GREEN} sub={`benchmark ${DAR_BENCHMARK}d`} />
        <Kpi label="Denial rate" value={pct(denials.denialRate)} accent={denials.denialRate > 0.08 ? AMBER : GREEN} sub={`${denials.deniedClaimCount} of ${book.totalClaims} claims`} />
        <Kpi label="Denied (period)" value={formatCents(denials.totalDeniedCents)} accent={AMBER} sub={`${pct(denials.appealableCents / Math.max(1, denials.totalDeniedCents))} appealable`} />
      </div>

      {/* A/R aging */}
      <div style={{ marginBottom: 30 }}>
        <SectionLabel meta="older money is harder to collect">A/R aging</SectionLabel>
        <div className="pc-card" style={{ ...card, padding: '18px 20px' }}>
          {/* stacked bar */}
          <div style={{ display: 'flex', height: 26, borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
            {aging.buckets.map((b, i) => b.pctOfTotal > 0 && (
              <div key={b.key} title={`${b.label}: ${formatCents(b.totalCents)}`} style={{ width: `${b.pctOfTotal * 100}%`, background: BUCKET_COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {b.pctOfTotal > 0.07 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff' }}>{(b.pctOfTotal * 100).toFixed(0)}%</span>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            {aging.buckets.map((b, i) => (
              <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: BUCKET_COLORS[i] }} />
                <span style={{ fontSize: 11.5, color: SUB }}>{b.label}</span>
              </div>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Age</th><th style={{ ...th, textAlign: 'right' }}>Insurance</th><th style={{ ...th, textAlign: 'right' }}>Patient</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={{ ...th, textAlign: 'right' }}>Claims</th><th style={{ ...th, textAlign: 'right' }}>% of A/R</th></tr></thead>
            <tbody>
              {aging.buckets.map((b, i) => (
                <tr key={b.key} className="pc-row">
                  <td style={td}><span style={{ width: 9, height: 9, borderRadius: 2, background: BUCKET_COLORS[i], display: 'inline-block', marginRight: 8 }} />{b.label}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(b.insuranceArCents)}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(b.patientArCents)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCents(b.totalCents)}</td>
                  <td style={{ ...td, textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{b.count}</td>
                  <td style={{ ...td, textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{(b.pctOfTotal * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two columns: A/R by payer + denials by payer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 30 }}>
        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, fontSize: 13.5, fontWeight: 600, color: INK }}>A/R by payer</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Payer</th><th style={{ ...th, textAlign: 'right' }}>Total A/R</th><th style={{ ...th, textAlign: 'right' }}>Over 90</th><th style={{ ...th, textAlign: 'right' }}>Claims</th></tr></thead>
            <tbody>
              {aging.byPayer.map((p) => (
                <tr key={p.payerExternalId} className="pc-row">
                  <td style={td}>{p.payerName}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCents(p.totalCents)}</td>
                  <td style={{ ...td, textAlign: 'right', color: p.over90Cents > 0 ? AMBER : FAINT, fontVariantNumeric: 'tabular-nums' }}>{formatCents(p.over90Cents)}</td>
                  <td style={{ ...td, textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, fontSize: 13.5, fontWeight: 600, color: INK }}>Denials by payer</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Payer</th><th style={{ ...th, textAlign: 'right' }}>Denials</th><th style={{ ...th, textAlign: 'right' }}>Denied</th><th style={{ ...th, textAlign: 'right' }}>Appealable</th></tr></thead>
            <tbody>
              {denials.byPayer.map((p) => (
                <tr key={p.payerExternalId} className="pc-row">
                  <td style={td}>{p.payerName}</td>
                  <td style={{ ...td, textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{p.count}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCents(p.deniedCents)}</td>
                  <td style={{ ...td, textAlign: 'right', color: GREEN, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCents(p.appealableCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Denials by reason */}
      <div>
        <SectionLabel meta="appealable dollars are the recovery opportunity">Top denial reasons</SectionLabel>
        <div className="pc-card" style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>CARC</th><th style={th}>Reason</th><th style={{ ...th, textAlign: 'right' }}>Count</th><th style={{ ...th, textAlign: 'right' }}>Denied</th><th style={{ ...th, textAlign: 'right' }}>Appealable</th><th style={{ ...th, textAlign: 'right' }}>% of denied</th></tr></thead>
            <tbody>
              {denials.byCarc.map((c) => (
                <tr key={c.carcCode} className="pc-row">
                  <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{c.carcCode}</td>
                  <td style={td}>
                    {c.description}
                    {c.appealable
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, background: '#e6f4ec', padding: '1px 7px', borderRadius: 999, marginLeft: 8 }}>appealable</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, color: SUB, background: '#f0ece3', padding: '1px 7px', borderRadius: 999, marginLeft: 8 }}>write-off</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{c.count}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.deniedCents)}</td>
                  <td style={{ ...td, textAlign: 'right', color: c.appealableCents > 0 ? GREEN : FAINT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.appealableCents > 0 ? formatCents(c.appealableCents) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: SUB, fontVariantNumeric: 'tabular-nums' }}>{(c.pctOfDenied * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 12.5, color: SUB }}>
              <strong style={{ color: GREEN }}>{formatCents(denials.appealableCents)}</strong> of {formatCents(denials.totalDeniedCents)} denied is appealable — the recovery worklist.
            </span>
            <Link href="/claims" style={{ fontSize: 12.5, color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Work the appeals →</Link>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: FAINT, marginTop: 22, lineHeight: 1.5 }}>
        Synthetic A/R book — the aging and denial math is the production engine (deterministic, reproducible); it runs unchanged on the real ledger and remittances once the COMPLIANCE.md gate is closed. CARC reasons classified by the shared HIPAA table; appeal letters are drafted by Claude, never the dollar figures.
      </p>
    </div>
  )
}
