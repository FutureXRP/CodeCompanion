import { searchPayers } from '@/lib/rcm/payers'
import { Badge } from '@/components/ui/Badge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Design tokens (match dashboard palette) ───────────────────────────────────
const INK   = '#1f2d27'
const SUB   = '#65726b'
const FAINT = '#9aa69f'
const LINE  = '#ece7dd'
const GREEN = '#2f8a5b'

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

// ── Transaction cell: green ✓ + optional amber "enroll" badge, or gray dash ──
function TxCell({ supported, enrollRequired }: { supported: boolean; enrollRequired: boolean }) {
  if (!supported) {
    return (
      <span style={{ color: FAINT, fontWeight: 500 }}>—</span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: GREEN, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>✓</span>
      {enrollRequired && <Badge label="enroll" variant="amber" />}
    </span>
  )
}

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string }>
}) {
  const params  = await searchParams
  const q       = (params.q     ?? '').trim()
  // Empty string means "all states"; missing param defaults to OK
  const rawState = params.state
  const state   = rawState === undefined ? 'OK' : rawState.trim()

  const { total, results } = searchPayers({ q, state: state || undefined, limit: 100 })

  const capped   = results.length < total
  const countLabel = capped
    ? `${results.length} of ${total.toLocaleString()} payers (showing first 100)`
    : `${total.toLocaleString()} payer${total === 1 ? '' : 's'}`

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <style>{`
        .enr-row { transition: background .12s ease; }
        .enr-row:hover { background: #faf7f1; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>
          Enrollments
        </h1>
        <p style={{ fontSize: 13.5, color: SUB, margin: 0, maxWidth: 680, lineHeight: 1.55 }}>
          Every payer Stedi can reach. ✓&nbsp;= transaction supported; an <Badge label="enroll" variant="amber" /> tag means a
          one-time payer enrollment is required before it goes live.
        </p>
      </div>

      {/* ── Search form ─────────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: '16px 18px', marginBottom: 22 }}>
        <form method="get" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 260px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Payer name or ID
            </label>
            <input
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Search 3,600+ payers by name or ID…"
              style={{
                fontSize: 13.5, color: INK, background: '#f8f9fc',
                border: `1px solid ${LINE}`, borderRadius: 8,
                padding: '8px 12px', outline: 'none', width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              State
            </label>
            <input
              name="state"
              type="text"
              defaultValue={state}
              placeholder="e.g. OK"
              style={{
                fontSize: 13.5, color: INK, background: '#f8f9fc',
                border: `1px solid ${LINE}`, borderRadius: 8,
                padding: '8px 12px', outline: 'none', width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              fontSize: 13.5, fontWeight: 600, color: '#fff',
              background: 'linear-gradient(135deg, #57997f 0%, #34685a 100%)',
              border: 'none', borderRadius: 8, padding: '9px 20px',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(45,93,232,.18)',
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Results table ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 34 }}>
        <SectionLabel meta={countLabel}>Payer directory</SectionLabel>

        <div style={card}>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 130px 140px 90px 90px 100px',
              gap: 0,
              padding: '10px 18px',
              borderBottom: `1px solid ${LINE}`,
              background: '#faf7f1',
              borderRadius: '14px 14px 0 0',
            }}
          >
            {['Payer', 'Payer ID', 'States', 'Claims', 'ERA', 'Eligibility'].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 11.5, fontWeight: 700, color: FAINT,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {results.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: FAINT, fontSize: 13.5 }}>
              No payers matched your search.
            </div>
          ) : (
            results.map((p, i) => (
              <div
                key={p.stediId}
                className="enr-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 130px 140px 90px 90px 100px',
                  gap: 0,
                  padding: '11px 18px',
                  borderBottom: i < results.length - 1 ? `1px solid ${LINE}` : 'none',
                  alignItems: 'center',
                }}
              >
                {/* Payer name */}
                <span style={{ fontSize: 13, fontWeight: 500, color: INK, lineHeight: 1.35 }}>
                  {p.name}
                </span>

                {/* Payer ID — mono */}
                <span style={{
                  fontFamily: 'DM Mono, ui-monospace, monospace',
                  fontSize: 12, color: SUB,
                  background: '#f0ece3', padding: '2px 7px',
                  borderRadius: 5, display: 'inline-block',
                  width: 'fit-content',
                }}>
                  {p.payerId}
                </span>

                {/* States */}
                <span style={{ fontSize: 12, color: SUB, lineHeight: 1.45 }}>
                  {p.states.length ? p.states.join(', ') : '—'}
                </span>

                {/* Claims */}
                <TxCell supported={p.professionalClaim} enrollRequired={p.professionalClaimEnrollmentRequired} />

                {/* ERA */}
                <TxCell supported={p.era} enrollRequired={p.eraEnrollmentRequired} />

                {/* Eligibility */}
                <TxCell supported={p.eligibility} enrollRequired={p.eligibilityEnrollmentRequired} />
              </div>
            ))
          )}
        </div>

        {capped && (
          <p style={{ fontSize: 12, color: FAINT, marginTop: 10, textAlign: 'right' }}>
            Showing first 100 results — narrow your search to see more.
          </p>
        )}
      </div>
    </div>
  )
}
