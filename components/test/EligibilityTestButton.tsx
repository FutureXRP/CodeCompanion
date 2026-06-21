'use client'
import { useState } from 'react'

const fmt = (c?: number | null) => (c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

interface Elig {
  provider: string
  sandbox: boolean
  result: {
    status: string
    payer?: { name?: string }
    member?: { firstName?: string; lastName?: string }
    copayCents?: number | null
    coinsurancePercent?: number | null
    deductibleRemainingCents?: number | null
    planName?: string | null
  }
}

/** Runs a real 270/271 eligibility check (Stedi sandbox, or the local mock) and shows the benefits. */
export function EligibilityTestButton() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Elig | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('/api/eligibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`)
      setData(j as Elig)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const r = data?.result
  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: loading ? '#9bb3a8' : 'linear-gradient(135deg, #57997f 0%, #34685a 100%)', border: 'none', borderRadius: 9, padding: '10px 18px', cursor: loading ? 'default' : 'pointer', boxShadow: '0 2px 8px rgba(52,104,90,0.25)' }}
      >
        {loading ? 'Checking eligibility…' : '✓  Run an eligibility check (270/271)'}
      </button>
      {error && <div style={{ marginTop: 12, fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 9, padding: '10px 14px' }}>{error}</div>}
      {r && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#1f2d27', background: '#e6f4ec', border: '1px solid #c4e3d2', borderRadius: 9, padding: '12px 14px', lineHeight: 1.6 }}>
          <div>
            <strong>{r.member?.firstName} {r.member?.lastName}</strong> · {r.payer?.name ?? '—'} ·{' '}
            <strong style={{ color: r.status === 'active' ? '#2f8a5b' : '#b8862a' }}>{r.status}</strong>{' '}
            <span style={{ color: '#6b7280' }}>({data?.provider}{data?.sandbox ? ' · sandbox' : ''})</span>
          </div>
          <div style={{ marginTop: 4, color: '#4b5b52', fontSize: 12.5 }}>
            Copay {fmt(r.copayCents)} · Coinsurance {r.coinsurancePercent != null ? Math.round(r.coinsurancePercent * 100) + '%' : '—'} · Deductible remaining {fmt(r.deductibleRemainingCents)}
            {r.planName ? ' · ' + r.planName : ''}
          </div>
        </div>
      )}
    </div>
  )
}
