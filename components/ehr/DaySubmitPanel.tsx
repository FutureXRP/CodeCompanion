'use client'
import { useState } from 'react'

const INK = '#16213a'
const SUB = '#5a6473'
const LINE = '#e9ecf2'

export interface ClaimRow {
  controlNumber: string
  patientName: string
  payerName: string
  payerId: string
  cpts: string
  scrubOk: boolean
  scrubWarnings: number
}

interface Result {
  outcome: 'accepted' | 'rejected' | 'blocked'
  category?: string
  detail: string
  tradingPartnerServiceId: string
  httpStatus?: number
  raw?: unknown
}
type Status = 'idle' | 'submitting' | 'done'
interface RowState {
  status: Status
  result?: Result
}

const OUTCOME = {
  accepted: { label: 'Accepted', bg: '#e8f6ee', fg: '#1a7a45', dot: '#1a7a45' },
  rejected: { label: 'Rejected', bg: '#fff5f5', fg: '#c9302c', dot: '#c9302c' },
  blocked: { label: 'Blocked', bg: '#fdf4e3', fg: '#92400e', dot: '#b45309' },
} as const

export function DaySubmitPanel({ claims, configured, sandbox }: { claims: ClaimRow[]; configured: boolean; sandbox: boolean }) {
  const [routing, setRouting] = useState<'test' | 'real'>('test')
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [error, setError] = useState<string | null>(null)

  async function submitOne(controlNumber: string, useTestPayer: boolean): Promise<void> {
    setRows((r) => ({ ...r, [controlNumber]: { status: 'submitting' } }))
    try {
      const res = await fetch('/api/ehr/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ controlNumbers: [controlNumber], useTestPayer }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      const result = data.results?.[0] as Result | undefined
      setRows((r) => ({ ...r, [controlNumber]: { status: 'done', result } }))
    } catch (e) {
      setRows((r) => ({ ...r, [controlNumber]: { status: 'done', result: { outcome: 'rejected', detail: e instanceof Error ? e.message : 'Request failed', tradingPartnerServiceId: '' } } }))
    }
  }

  async function submitAll(): Promise<void> {
    setError(null)
    setRunning(true)
    setRows({})
    try {
      for (const c of claims) await submitOne(c.controlNumber, routing === 'test')
    } finally {
      setRunning(false)
    }
  }

  if (!configured) {
    return (
      <div style={{ background: '#fdf4e3', border: '1px solid #f6e0b5', borderRadius: 12, padding: '16px 18px', fontSize: 13.5, color: '#92400e', lineHeight: 1.55 }}>
        <strong>STEDI_API_KEY isn&apos;t set on this deployment.</strong> Add <code>STEDI_API_KEY</code> and <code>STEDI_SANDBOX=true</code> in Vercel → Environment Variables, then redeploy to submit the day live.
      </div>
    )
  }

  const done = claims.map((c) => rows[c.controlNumber]?.result).filter(Boolean) as Result[]
  const accepted = done.filter((r) => r.outcome === 'accepted').length
  const rejected = done.filter((r) => r.outcome === 'rejected').length
  const blocked = done.filter((r) => r.outcome === 'blocked').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <button
          onClick={submitAll}
          disabled={running}
          style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', background: running ? '#9bb0e8' : 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: running ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(45,93,232,.2)' }}
        >
          {running ? 'Submitting…' : `Submit ${claims.length} claims to Stedi`}
        </button>

        <div style={{ display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 9, overflow: 'hidden', fontSize: 12.5 }}>
          {(['test', 'real'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setRouting(mode)}
              disabled={running}
              style={{ padding: '7px 12px', border: 'none', cursor: running ? 'default' : 'pointer', fontWeight: 600, color: routing === mode ? '#1e4acc' : SUB, background: routing === mode ? '#eef3ff' : '#fff' }}
            >
              {mode === 'test' ? 'Test payer (STEDITEST)' : 'Real payer ids'}
            </button>
          ))}
        </div>

        {done.length > 0 && (
          <span style={{ fontSize: 12.5, color: SUB }}>
            <strong style={{ color: '#1a7a45' }}>{accepted} accepted</strong> · <strong style={{ color: '#c9302c' }}>{rejected} rejected</strong>
            {blocked > 0 ? <> · <strong style={{ color: '#b45309' }}>{blocked} blocked</strong></> : null}
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#9aa3b2', margin: '0 0 14px', lineHeight: 1.5 }}>
        {routing === 'test'
          ? 'Routing every claim to the Stedi Test Payer (STEDITEST) — reliable test adjudication, a real 277CA per claim. In production each maps to its real payer id (the enrollment step).'
          : 'Routing to each claim’s real payer id — the genuine path. Some may reject (e.g. a payer not enrolled for test); use Resolve to re-route a rejection to the test payer.'}
        {' '}Test mode (usageIndicator “T”): synthetic data, no real payer, no money.
      </p>

      {error && <div style={{ background: '#fff5f5', border: '1px solid #ffe0e0', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#c9302c', marginBottom: 14 }}>{error}</div>}

      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
        {claims.map((c, i) => {
          const st = rows[c.controlNumber]
          const r = st?.result
          const o = r ? OUTCOME[r.outcome] : null
          return (
            <div key={c.controlNumber} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${LINE}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{c.patientName}</div>
                <div style={{ fontSize: 11, color: '#9aa3b2', fontFamily: 'DM Mono, monospace' }}>{c.controlNumber}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: SUB }}>
                  {c.payerName} <span style={{ color: '#b6bdca' }}>·</span> <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5 }}>{c.cpts}</span>
                </div>
                {!c.scrubOk && <div style={{ fontSize: 11.5, color: '#c9302c', marginTop: 2 }}>scrub: errors must fix</div>}
                {c.scrubOk && c.scrubWarnings > 0 && <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>scrub: {c.scrubWarnings} warning{c.scrubWarnings > 1 ? 's' : ''} (review)</div>}
                {r && (
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 12, color: r.outcome === 'accepted' ? '#1a7a45' : r.outcome === 'rejected' ? '#c9302c' : '#92400e' }}>
                      {r.detail}{r.category ? ` (${r.category})` : ''} {r.tradingPartnerServiceId ? <span style={{ color: '#9aa3b2' }}>→ {r.tradingPartnerServiceId}</span> : null}
                    </span>
                    {r.outcome !== 'accepted' && (
                      <button onClick={() => submitOne(c.controlNumber, true)} disabled={running} style={{ marginLeft: 10, fontSize: 11.5, fontWeight: 600, color: '#1e4acc', background: '#eef3ff', border: '1px solid #d7e0f5', borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>
                        Resolve → resubmit to test payer
                      </button>
                    )}
                    {r.raw != null && (
                      <details style={{ marginTop: 5 }}>
                        <summary style={{ fontSize: 11, color: '#9aa3b2', cursor: 'pointer' }}>raw Stedi response</summary>
                        <pre style={{ margin: '6px 0 0', padding: '10px 12px', background: '#fafbfd', border: `1px solid ${LINE}`, borderRadius: 8, fontFamily: 'DM Mono, ui-monospace, monospace', fontSize: 11, lineHeight: 1.5, color: '#333d4d', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
                          {JSON.stringify(r.raw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, width: 96, textAlign: 'right' }}>
                {st?.status === 'submitting' ? (
                  <span style={{ fontSize: 12, color: '#3b6ef8', fontWeight: 600 }}>processing…</span>
                ) : o ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: o.fg, background: o.bg, padding: '3px 10px', borderRadius: 999 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: o.dot }} />
                    {o.label}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: '#c0c6d0' }}>queued</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
