'use client'
import { useState } from 'react'

interface PullResult {
  source: string
  serviceDate: string
  encounters: number
  billedCents: number
  findings: number
  recoverableCents: number
  persisted: boolean
  persistError?: string | null
}

const fmt = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Pulls a day from athena, runs the found-money diff, saves to Neon, shows the dollars. */
export function AthenaPullButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PullResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pull() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ehr/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data as PullResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={pull}
        disabled={loading}
        style={{
          fontSize: 13, fontWeight: 600, color: '#fff',
          background: loading ? '#9bb3a8' : 'linear-gradient(135deg, #57997f 0%, #34685a 100%)',
          border: 'none', borderRadius: 9, padding: '10px 18px', cursor: loading ? 'default' : 'pointer',
          boxShadow: '0 2px 8px rgba(52,104,90,0.25)',
        }}
      >
        {loading ? 'Pulling from athena…' : '↓  Pull from athena → find money → save to Neon'}
      </button>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 9, padding: '10px 14px', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#1f2d27', background: '#e6f4ec', border: '1px solid #c4e3d2', borderRadius: 9, padding: '12px 14px', lineHeight: 1.6 }}>
          <div>
            Pulled <strong>{result.encounters}</strong> encounter{result.encounters === 1 ? '' : 's'} from athena
            <span style={{ color: '#6b7280' }}> ({result.source === 'mock' ? 'synthetic mock' : 'live Preview'} · {result.serviceDate})</span>
            {' · '}<strong>{fmt(result.billedCents)}</strong> billed
          </div>
          <div style={{ marginTop: 4 }}>
            Found-money diff: <strong>{result.findings}</strong> finding{result.findings === 1 ? '' : 's'}
            {' · '}<strong style={{ color: '#2f8a5b' }}>{fmt(result.recoverableCents)} recoverable</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#4b5b52' }}>
            {result.persisted ? 'Saved to your Neon database ✓ — ' : `(not saved: ${result.persistError}) — `}
            now in <a href="/found-money" style={{ color: '#34685a', fontWeight: 600 }}>Found Money</a> and <a href="/claims" style={{ color: '#34685a', fontWeight: 600 }}>Claims</a>.
          </div>
        </div>
      )}
    </div>
  )
}
