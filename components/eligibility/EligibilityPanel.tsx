'use client'
import { useState } from 'react'
import { formatCents } from '@/lib/canonical'
import type { BenefitItem, EligibilityResult } from '@/lib/rcm/eligibility'

const INK = '#16213a'
const SUB = '#5a6473'
const LINE = '#e9ecf2'

/** Never render a raw nested object into React (CLAUDE.md). Coerce to a display string. */
function safeStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

// Stedi's documented "Eligibility mock requests" — each returns canned benefits
// on a TEST API key. Exact values are required (Stedi rejects other names/ids/dobs).
interface Scenario { label: string; payerName: string; payerId: string; memberId: string; firstName: string; lastName: string; dateOfBirth: string }
const SCENARIOS: Scenario[] = [
  { label: 'Active coverage — Aetna', payerName: 'Aetna', payerId: '60054', memberId: 'AETNA12345', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '2004-04-04' },
  { label: 'Active coverage — Cigna', payerName: 'Cigna', payerId: '62308', memberId: '23456789100', firstName: 'James', lastName: 'Jones', dateOfBirth: '1991-02-02' },
  { label: 'Active coverage — Humana', payerName: 'Humana', payerId: '61101', memberId: 'HUMANA123', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1975-05-05' },
  { label: 'Active coverage — Ambetter', payerName: 'Ambetter', payerId: '68069', memberId: 'AMBETTER123', firstName: 'John', lastName: 'Doe', dateOfBirth: '1994-04-04' },
  { label: 'Inactive coverage — UnitedHealthcare', payerName: 'UnitedHealthcare', payerId: '87726', memberId: 'UHCINACTIVE', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1971-01-01' },
  { label: 'Medicare — CMS', payerName: 'CMS', payerId: 'CMS', memberId: 'CMS12345678', firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1955-05-05' },
]
function scenarioForm(s: Scenario) {
  return { memberId: s.memberId, firstName: s.firstName, lastName: s.lastName, dateOfBirth: s.dateOfBirth, gender: '', payerName: s.payerName, payerId: s.payerId, serviceTypeCode: '30' }
}
const TEST_MEMBER = scenarioForm(SCENARIOS[0])

// Provider for sandbox mocks: any name + any check-digit-valid NPI works (Stedi docs).
// In production this comes from the signed-in practice, not the form.
const TEST_PROVIDER = { npi: '1999999984', organizationName: 'Provider Name' }

const STATUS_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  active: { fg: '#1a7a45', bg: '#e8f6ee', label: 'Active coverage' },
  inactive: { fg: '#c9302c', bg: '#fff5f5', label: 'Inactive / terminated' },
  unknown: { fg: '#92400e', bg: '#fdf4e3', label: 'Coverage unknown' },
}

const NETWORK_LABEL: Record<string, string> = {
  in_network: 'In-network',
  out_of_network: 'Out-of-network',
  unknown: '—',
}

export function EligibilityPanel({ configured, sandbox }: { configured: boolean; sandbox: boolean }) {
  const [form, setForm] = useState(TEST_MEMBER)
  const [scenario, setScenario] = useState(SCENARIOS[0].label)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EligibilityResult | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [raw, setRaw] = useState<unknown>(null)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function check() {
    setLoading(true)
    setError(null)
    setResult(null)
    setRaw(null)
    try {
      const request = {
        payer: { externalId: form.payerId.trim(), name: form.payerName.trim() },
        subscriber: {
          memberId: form.memberId.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth.trim() || undefined,
          gender: form.gender || undefined,
        },
        provider: TEST_PROVIDER,
        serviceTypeCodes: [form.serviceTypeCode.trim() || '30'],
      }
      const res = await fetch('/api/eligibility', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      setResult(data.result as EligibilityResult)
      setProvider(safeStr(data.provider) || null)
      setRaw(data.raw ?? data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Test scenario — Stedi documented mock</label>
          <select
            value={scenario}
            onChange={(e) => { setScenario(e.target.value); const s = SCENARIOS.find((x) => x.label === e.target.value); if (s) setForm(scenarioForm(s)) }}
            style={{ ...inputStyle, maxWidth: 380 }}
          >
            {SCENARIOS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Field label="Member ID" value={form.memberId} onChange={(v) => set('memberId', v)} />
          <Field label="First name" value={form.firstName} onChange={(v) => set('firstName', v)} />
          <Field label="Last name" value={form.lastName} onChange={(v) => set('lastName', v)} />
          <Field label="Date of birth" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} placeholder="YYYY-MM-DD" />
          <div>
            <label style={labelStyle}>Sex</label>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} style={inputStyle}>
              <option value="">—</option>
              <option value="F">F</option>
              <option value="M">M</option>
              <option value="U">U</option>
            </select>
          </div>
          <Field label="Payer name" value={form.payerName} onChange={(v) => set('payerName', v)} />
          <Field label="Payer ID" value={form.payerId} onChange={(v) => set('payerId', v)} />
          <Field label="Service type" value={form.serviceTypeCode} onChange={(v) => set('serviceTypeCode', v)} placeholder="30" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={check}
            disabled={loading}
            style={{
              fontSize: 13.5, fontWeight: 600, color: '#fff',
              background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)',
              border: 'none', borderRadius: 10, padding: '10px 20px',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(45,93,232,.2)',
            }}
          >
            {loading ? 'Checking…' : 'Check eligibility'}
          </button>
          <span style={{ fontSize: 12, color: SUB }}>
            {configured ? `→ Stedi ${sandbox ? 'sandbox (test mode)' : 'PRODUCTION'}` : '→ local mock (no STEDI_API_KEY set)'}
            {provider ? ` · responded via ${provider}` : ''}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #ffe0e0', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#c9302c', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {result && <ResultView result={result} raw={raw} />}

      <p style={{ fontSize: 12, color: '#9aa3b2', marginTop: 16, lineHeight: 1.5 }}>
        {configured
          ? sandbox
            ? 'Test mode — synthetic members only, no real PHI; nothing is sent to a real payer.'
            : 'PRODUCTION mode — transmits real member PHI to payers; gated by ALLOW_REAL_PHI (COMPLIANCE.md).'
          : 'Local mock — deterministic synthetic benefits, no network or account. Set STEDI_API_KEY + STEDI_SANDBOX=true to call the real sandbox.'}
        {' '}Benefit figures are parsed deterministically from the 271 — never generated.
      </p>
    </div>
  )
}

function ResultView({ result, raw }: { result: EligibilityResult; raw: unknown }) {
  const status = STATUS_STYLE[result.status] ?? STATUS_STYLE.unknown
  const member = `${safeStr(result.member?.firstName)} ${safeStr(result.member?.lastName)}`.trim()
  const cards: { label: string; value: string }[] = []
  if (result.planName) cards.push({ label: 'Plan', value: safeStr(result.planName) })
  if (result.copayCents != null) cards.push({ label: 'Copay', value: formatCents(result.copayCents) })
  if (result.coinsurancePercent != null) cards.push({ label: 'Coinsurance', value: `${Math.round(result.coinsurancePercent * 100)}%` })
  if (result.deductibleCents != null) {
    cards.push({
      label: 'Deductible',
      value: result.deductibleRemainingCents != null
        ? `${formatCents(result.deductibleCents)} · ${formatCents(result.deductibleRemainingCents)} left`
        : formatCents(result.deductibleCents),
    })
  }
  if (result.outOfPocketCents != null) {
    cards.push({
      label: 'Out-of-pocket max',
      value: result.outOfPocketRemainingCents != null
        ? `${formatCents(result.outOfPocketCents)} · ${formatCents(result.outOfPocketRemainingCents)} left`
        : formatCents(result.outOfPocketCents),
    })
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '14px 18px', background: status.bg, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: status.fg }}>{status.label}</span>
          {member && <span style={{ fontSize: 13, color: INK }}>· {member}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {result.mode && (
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: result.mode === 'production' ? '#c9302c' : '#1a7a45', background: result.mode === 'production' ? '#fff5f5' : '#e8f6ee', padding: '2px 8px', borderRadius: 999 }} title={result.mode === 'production' ? 'Your Stedi API key is a PRODUCTION key — this hit the real payer.' : 'Stedi ran this against the test payer.'}>
              {result.mode}
            </span>
          )}
          <span style={{ fontSize: 12, color: SUB }}>{safeStr(result.payer?.name)}</span>
        </div>
      </div>

      {result.errors && result.errors.length > 0 && (
        <div style={{ padding: '10px 18px', fontSize: 12.5, color: '#c9302c', borderBottom: `1px solid ${LINE}` }}>
          {result.errors.map(safeStr).join('; ')}
        </div>
      )}

      {cards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: LINE }}>
          {cards.map((c) => (
            <div key={c.label} style={{ background: '#fff', padding: '12px 18px' }}>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <BenefitsTable benefits={result.benefits ?? []} />

      <details style={{ borderTop: `1px solid ${LINE}` }}>
        <summary style={{ padding: '10px 18px', fontSize: 12.5, fontWeight: 600, color: SUB, cursor: 'pointer' }}>
          Raw 271 response
        </summary>
        <pre style={{ margin: 0, padding: '12px 18px', fontFamily: 'DM Mono, ui-monospace, monospace', fontSize: 11.5, lineHeight: 1.5, color: '#333d4d', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 360, overflow: 'auto', background: '#fafbfd' }}>
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function BenefitsTable({ benefits }: { benefits: BenefitItem[] }) {
  if (benefits.length === 0) {
    return <div style={{ padding: '16px 18px', fontSize: 13, color: SUB }}>No benefit detail returned.</div>
  }
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: SUB, padding: '8px 12px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12.5, color: INK, padding: '8px 12px', borderBottom: `1px solid #f3f5f9`, verticalAlign: 'top' }
  return (
    <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Benefit</th>
            <th style={th}>Service type</th>
            <th style={th}>Network</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount / %</th>
            <th style={th}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {benefits.map((b, i) => (
            <tr key={i}>
              <td style={td}>
                <span style={{ fontWeight: 600 }}>{safeStr(b.name) || safeStr(b.code)}</span>
                <span style={{ color: '#9aa3b2', marginLeft: 6, fontSize: 11 }}>{safeStr(b.code)}</span>
              </td>
              <td style={td}>{(b.serviceTypes ?? []).map(safeStr).join(', ') || (b.serviceTypeCodes ?? []).map(safeStr).join(', ') || '—'}</td>
              <td style={td}>{NETWORK_LABEL[b.network] ?? '—'}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
                {b.amountCents != null ? formatCents(b.amountCents) : b.percent != null ? `${Math.round(b.percent * 100)}%` : '—'}
              </td>
              <td style={{ ...td, color: SUB }}>{(b.messages ?? []).map(safeStr).join(' ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: SUB, marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', fontSize: 13, color: INK, padding: '8px 10px', border: `1px solid #d7dee9`, borderRadius: 8, background: '#fff', boxSizing: 'border-box' }

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}
