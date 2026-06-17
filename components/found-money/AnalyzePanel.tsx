'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { formatCents } from '@/lib/canonical'
import type { AnalyzeResult } from '@/lib/analyze/run'
import type { ClaimStatus } from '@/lib/rcm/lifecycle'
import type { FindingType } from '@/lib/canonical'

const TYPE_VARIANT: Record<FindingType, 'blue' | 'red' | 'amber'> = {
  underpayment: 'blue',
  denial: 'red',
  undercoding: 'amber',
}
const STATUS_VARIANT: Record<ClaimStatus, 'green' | 'red' | 'amber' | 'blue' | 'gray'> = {
  paid: 'green',
  partially_paid: 'amber',
  denied: 'red',
  rejected: 'gray',
  submitted: 'blue',
  built: 'gray',
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '7px 10px', borderBottom: '1px solid #e4e8ef' }
const td: React.CSSProperties = { fontSize: 12.5, color: '#333d4d', padding: '9px 10px', borderBottom: '1px solid #f1f3f7', verticalAlign: 'top' }
const taLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' }
const ta: React.CSSProperties = { width: '100%', minHeight: 120, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: 1.45, padding: 10, border: '1px solid #e4e8ef', borderRadius: 8, resize: 'vertical', color: '#333d4d' }

export function AnalyzePanel({ initial837, initial835, initialCsv }: { initial837: string; initial835: string; initialCsv: string }) {
  const [edi837, setEdi837] = useState(initial837)
  const [edi835, setEdi835] = useState(initial835)
  const [csv, setCsv] = useState(initialCsv)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ edi837, edi835, feeScheduleCsv: csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Analysis failed')
      setResult(data as AnalyzeResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={taLabel}>837 — claims you submitted</label>
          <textarea style={ta} value={edi837} onChange={(e) => setEdi837(e.target.value)} spellCheck={false} />
        </div>
        <div>
          <label style={taLabel}>835 — remittance (what the payer paid)</label>
          <textarea style={ta} value={edi835} onChange={(e) => setEdi835(e.target.value)} spellCheck={false} />
        </div>
      </div>
      <label style={taLabel}>Fee schedule (CSV: payer_id, cpt_hcpcs, modifier, contracted_rate)</label>
      <textarea style={{ ...ta, minHeight: 90 }} value={csv} onChange={(e) => setCsv(e.target.value)} spellCheck={false} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 4px' }}>
        <button
          onClick={run}
          disabled={loading}
          style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#2d5de8', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {error && <span style={{ color: '#c9302c', fontSize: 13 }}>{error}</span>}
        <span style={{ fontSize: 12, color: '#9aa3b2' }}>Processed in memory — nothing is stored. Use synthetic / de-identified data until the BAA gate is closed.</span>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            <Stat label="Recoverable" value={formatCents(result.foundMoney.totals.recoverableCents)} accent="#1a7a45" />
            <Stat label="Findings" value={String(result.foundMoney.totals.count)} />
            <Stat label="Claims paid" value={`${result.claimTotals.paid} / ${result.claimTotals.total}`} />
            <Stat label="Denied" value={String(result.claimTotals.denied)} accent={result.claimTotals.denied > 0 ? '#c9302c' : undefined} />
          </div>

          <Section title="Claim lifecycle (from your 835)">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Claim</th><th style={th}>Payer</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Billed</th><th style={{ ...th, textAlign: 'right' }}>Paid</th></tr></thead>
              <tbody>
                {result.claims.map((c) => (
                  <tr key={c.claimControlNumber}>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace' }}>{c.claimControlNumber}</td>
                    <td style={td}>{c.payerName}</td>
                    <td style={td}><Badge label={c.status.replace('_', ' ')} variant={STATUS_VARIANT[c.status]} /></td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.billedCents)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.paidCents > 0 ? '#1a7a45' : '#9aa3b2' }}>{formatCents(c.paidCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Recovery worklist (ranked)">
            {result.foundMoney.findings.length === 0 ? (
              <p style={{ fontSize: 13, color: '#6b7280', padding: '10px 0' }}>No recoverable findings — every line paid at the contracted rate.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...th, textAlign: 'right' }}>Recoverable</th><th style={th}>Type</th><th style={th}>CPT</th><th style={th}>Detail</th></tr></thead>
                <tbody>
                  {result.foundMoney.findings.map((f) => (
                    <tr key={f.id}>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#1a7a45', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatCents(f.recoverableCents)}</td>
                      <td style={td}><Badge label={f.type} variant={TYPE_VARIANT[f.type]} /></td>
                      <td style={{ ...td, fontFamily: 'ui-monospace, monospace' }}>{f.cptHcpcs}</td>
                      <td style={{ ...td, color: '#4a5366', maxWidth: 460 }}>{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#1e2533', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ padding: '11px 14px', borderBottom: '1px solid #f1f3f7', fontSize: 13, fontWeight: 600, color: '#1e2533' }}>{title}</div>
      <div style={{ padding: '2px 4px' }}>{children}</div>
    </div>
  )
}
