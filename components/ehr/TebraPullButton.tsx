'use client'
import { useState } from 'react'

interface TypeTotal { count: number; recoverableCents: number }

interface PullResult {
  source: string
  serviceDateFrom: string
  serviceDateTo: string
  encounters: number
  lines: number
  billedCents: number
  expectedCents: number
  paidCents: number
  contractRates: number
  findings: number
  recoverableCents: number
  byType: { underpayment: TypeTotal; denial: TypeTotal; undercoding: TypeTotal; unadjudicated: TypeTotal }
  persisted: boolean
  persistError?: string | null
}

const fmt = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Pulls charges + their adjudication from Tebra, runs the found-money diff, saves to Neon, shows the dollars. */
export function TebraPullButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PullResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pull() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ehr/tebra', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data as PullResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const t = result?.byType

  return (
    <div>
      <button
        onClick={pull}
        disabled={loading}
        style={{
          fontSize: 13, fontWeight: 600, color: '#fff',
          background: loading ? '#9bb3a8' : 'linear-gradient(135deg, #4f7fb3 0%, #2f5a86 100%)',
          border: 'none', borderRadius: 9, padding: '10px 18px', cursor: loading ? 'default' : 'pointer',
          boxShadow: '0 2px 8px rgba(47,90,134,0.25)',
        }}
      >
        {loading ? 'Pulling from Tebra…' : '↓  Pull from Tebra → charges + ERA → find money → save to Neon'}
      </button>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 9, padding: '10px 14px', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {result && t && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#1f2d27', background: '#eaf1fa', border: '1px solid #cfdff2', borderRadius: 9, padding: '12px 14px', lineHeight: 1.6 }}>
          <div>
            Pulled <strong>{result.lines}</strong> charge line{result.lines === 1 ? '' : 's'} on <strong>{result.encounters}</strong> encounter{result.encounters === 1 ? '' : 's'} from Tebra
            <span style={{ color: '#6b7280' }}>
              {' '}({result.source === 'mock' ? 'synthetic mock' : 'live'} · {result.serviceDateFrom}{result.serviceDateTo !== result.serviceDateFrom ? ` → ${result.serviceDateTo}` : ''})
            </span>
          </div>
          <div>
            <strong>{fmt(result.billedCents)}</strong> billed · <strong>{fmt(result.expectedCents)}</strong> contract-expected ({result.contractRates} rates from Tebra) · <strong>{fmt(result.paidCents)}</strong> paid
          </div>
          <div style={{ marginTop: 4 }}>
            Found-money diff: <strong>{result.findings}</strong> finding{result.findings === 1 ? '' : 's'}
            {' · '}<strong style={{ color: '#2f8a5b' }}>{fmt(result.recoverableCents)} recoverable</strong>
            <span style={{ color: '#4b5b52' }}>
              {' '}— {t.underpayment.count} underpaid ({fmt(t.underpayment.recoverableCents)}), {t.denial.count} denied ({fmt(t.denial.recoverableCents)}),
              {' '}{t.unadjudicated.count} unanswered ({fmt(t.unadjudicated.recoverableCents)}), {t.undercoding.count} undercoded
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#4b5b52' }}>
            {result.persisted ? 'Saved to your Neon database ✓ — ' : `(not saved: ${result.persistError}) — `}
            now in <a href="/found-money" style={{ color: '#2f5a86', fontWeight: 600 }}>Found Money</a> and <a href="/claims" style={{ color: '#2f5a86', fontWeight: 600 }}>Claims</a>.
          </div>
        </div>
      )}
    </div>
  )
}
