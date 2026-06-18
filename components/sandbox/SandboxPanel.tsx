'use client'
import { useState } from 'react'

const INK = '#16213a'
const SUB = '#5a6473'
const LINE = '#e9ecf2'

type Action = 'submit' | 'status' | 'remittances'

const BUTTONS: { action: Action; label: string; hint: string }[] = [
  { action: 'submit', label: 'Submit sample 837', hint: 'transmit the synthetic claims' },
  { action: 'status', label: 'Check status', hint: '276/277 inquiry' },
  { action: 'remittances', label: 'Fetch ERAs', hint: 'pull 835 remittances' },
]

export function SandboxPanel({ configured, sandbox }: { configured: boolean; sandbox: boolean }) {
  const [loading, setLoading] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ action: Action; payload: unknown } | null>(null)

  async function run(action: Action) {
    setLoading(action)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/clearinghouse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      setResult({ action, payload: data })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(null)
    }
  }

  if (!configured) {
    return (
      <div style={{ background: '#fdf4e3', border: '1px solid #f6e0b5', borderRadius: 12, padding: '16px 18px', fontSize: 13.5, color: '#92400e', lineHeight: 1.55 }}>
        <strong>STEDI_API_KEY isn&apos;t set on this deployment.</strong> Add <code>STEDI_API_KEY</code> and
        <code> STEDI_SANDBOX=true</code> in Vercel → Settings → Environment Variables, then redeploy to run live sandbox trials.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {BUTTONS.map((b, i) => (
          <button
            key={b.action}
            onClick={() => run(b.action)}
            disabled={loading !== null}
            style={{
              fontSize: 13.5, fontWeight: 600,
              color: i === 0 ? '#fff' : '#2d4a7a',
              background: i === 0 ? 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)' : '#fff',
              border: i === 0 ? 'none' : '1px solid #d7e0f5',
              borderRadius: 10, padding: '10px 16px',
              cursor: loading ? 'default' : 'pointer', opacity: loading && loading !== b.action ? 0.55 : 1,
              boxShadow: i === 0 ? '0 4px 14px rgba(45,93,232,.2)' : 'none',
            }}
          >
            {loading === b.action ? 'Calling Stedi…' : b.label}
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 400, opacity: 0.8 }}>{b.hint}</span>
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #ffe0e0', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#c9302c', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${LINE}`, fontSize: 13, fontWeight: 600, color: INK }}>
            Response · <span style={{ fontFamily: 'DM Mono, monospace', color: SUB }}>{result.action}</span>
          </div>
          <pre style={{ margin: 0, padding: '14px 16px', fontFamily: 'DM Mono, ui-monospace, monospace', fontSize: 12, lineHeight: 1.5, color: '#333d4d', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 420, overflow: 'auto' }}>
            {JSON.stringify(result.payload, null, 2)}
          </pre>
        </div>
      )}

      <p style={{ fontSize: 12, color: '#9aa3b2', marginTop: 14, lineHeight: 1.5 }}>
        {sandbox ? 'Sandbox mode (usageIndicator "T") — synthetic test claims only, no real PHI.' : 'PRODUCTION mode — gated by ALLOW_REAL_PHI + payer enrollment.'}
        {' '}If a call fails, the raw HTTP status and Stedi response above show exactly what to adjust.
      </p>
    </div>
  )
}
