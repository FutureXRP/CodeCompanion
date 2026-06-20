'use client'
import { useState } from 'react'

const INK = '#1f2d27'
const SUB = '#65726b'
const LINE = '#ece7dd'

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
  accepted: { label: 'Accepted', bg: '#e6f4ec', fg: '#2f8a5b', dot: '#2f8a5b' },
  rejected: { label: 'Rejected', bg: '#fae9e6', fg: '#cf5547', dot: '#cf5547' },
  blocked: { label: 'Blocked', bg: '#f6efdd', fg: '#92400e', dot: '#b8862a' },
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
      <div style={{ background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 12, padding: '16px 18px', fontSize: 13.5, color: '#92400e', lineHeight: 1.55 }}>
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
          style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', background: running ? '#9bb0e8' : 'linear-gradient(135deg, #57997f 0%, #34685a 100%)', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: running ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(45,93,232,.2)' }}
        >
          {running ? 'Submitting…' : `Submit ${claims.length} claims → ${routing === 'test' ? 'STEDITEST' : 'real payers'}`}
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: SUB }}>Route to</span>
          <div style={{ display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 9, overflow: 'hidden', fontSize: 12.5 }}>
            {(['test', 'real'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setRouting(mode)}
                disabled={running}
                title={mode === 'test' ? 'Send to the Stedi Test Payer' : 'Send to each claim’s real payer id'}
                style={{ padding: '7px 12px', border: 'none', cursor: running ? 'default' : 'pointer', fontWeight: 600, color: routing === mode ? '#34685a' : SUB, background: routing === mode ? '#eef3ff' : '#fff' }}
              >
                {mode === 'test' ? 'Test payer (STEDITEST)' : 'Real payer ids'}
              </button>
            ))}
          </div>
        </div>

        {done.length > 0 && (
          <span style={{ fontSize: 12.5, color: SUB }}>
            <strong style={{ color: '#2f8a5b' }}>{accepted} accepted</strong> · <strong style={{ color: '#cf5547' }}>{rejected} rejected</strong>
            {blocked > 0 ? <> · <strong style={{ color: '#b8862a' }}>{blocked} blocked</strong></> : null}
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#9aa69f', margin: '0 0 14px', lineHeight: 1.5 }}>
        {routing === 'test'
          ? 'Routing every claim to the Stedi Test Payer (STEDITEST) — reliable test adjudication, a real 277CA per claim. In production each maps to its real payer id (the enrollment step).'
          : 'Routing to each claim’s real payer id — the genuine path. Some may reject (e.g. a payer not enrolled for test); use Resolve to re-route a rejection to the test payer.'}
        {' '}Test mode (usageIndicator “T”): synthetic data, no real payer, no money.
      </p>

      {error && <div style={{ background: '#fae9e6', border: '1px solid #f3d9d3', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#cf5547', marginBottom: 14 }}>{error}</div>}

      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
        {claims.map((c, i) => {
          const st = rows[c.controlNumber]
          const r = st?.result
          const o = r ? OUTCOME[r.outcome] : null
          return (
            <div key={c.controlNumber} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${LINE}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{c.patientName}</div>
                <div style={{ fontSize: 11, color: '#9aa69f', fontFamily: 'DM Mono, monospace' }}>{c.controlNumber}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: SUB }}>
                  {c.payerName} <span style={{ color: '#b6bdca' }}>·</span> <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5 }}>{c.cpts}</span>
                </div>
                {!c.scrubOk && <div style={{ fontSize: 11.5, color: '#cf5547', marginTop: 2 }}>scrub: errors must fix</div>}
                {c.scrubOk && c.scrubWarnings > 0 && <div style={{ fontSize: 11.5, color: '#b8862a', marginTop: 2 }}>scrub: {c.scrubWarnings} warning{c.scrubWarnings > 1 ? 's' : ''} (review)</div>}
                {r && (
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 12, color: r.outcome === 'accepted' ? '#2f8a5b' : r.outcome === 'rejected' ? '#cf5547' : '#92400e' }}>
                      {r.detail}{r.category ? ` (${r.category})` : ''} {r.tradingPartnerServiceId ? <span style={{ color: '#9aa69f' }}>→ {r.tradingPartnerServiceId}</span> : null}
                    </span>
                    {r.outcome !== 'accepted' && (
                      <button onClick={() => submitOne(c.controlNumber, true)} disabled={running} style={{ marginLeft: 10, fontSize: 11.5, fontWeight: 600, color: '#34685a', background: '#eef3ff', border: '1px solid #d6e2da', borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>
                        Resolve → resubmit to test payer
                      </button>
                    )}
                    {r.raw != null && (
                      <details style={{ marginTop: 5 }}>
                        <summary style={{ fontSize: 11, color: '#9aa69f', cursor: 'pointer' }}>raw Stedi response</summary>
                        <pre style={{ margin: '6px 0 0', padding: '10px 12px', background: '#faf7f1', border: `1px solid ${LINE}`, borderRadius: 8, fontFamily: 'DM Mono, ui-monospace, monospace', fontSize: 11, lineHeight: 1.5, color: '#3a4640', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
                          {JSON.stringify(r.raw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, width: 96, textAlign: 'right' }}>
                {st?.status === 'submitting' ? (
                  <span style={{ fontSize: 12, color: '#57997f', fontWeight: 600 }}>processing…</span>
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
