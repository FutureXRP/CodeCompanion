'use client'
import { useState } from 'react'
import type { Claim } from '@/lib/canonical'

const fmt = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Adj {
  edi837: string | null
  scrub: { ok: boolean; warningCount: number; warnings?: { code?: string; message?: string }[]; errors?: { code?: string; message?: string }[] }
  remittance: null | {
    totalBilledCents: number; totalPaidCents: number; patientRespCents: number; claimStatusCode: string
    lines: { cptHcpcs: string; billedCents: number; allowedCents: number; paidCents: number; patientRespCents: number; adjustments: { groupCode: string; carcCode: string; amountCents: number }[] }[]
  }
  findings: { type: string; cptHcpcs: string; recoverableCents: number; appealable: boolean; reason: string; carcCode?: string }[]
}

const inp: React.CSSProperties = { fontSize: 12.5, color: '#1f2d27', border: '1px solid #d7dde7', borderRadius: 7, padding: '6px 8px', fontFamily: 'DM Mono, monospace', width: '100%', boxSizing: 'border-box', background: '#fff' }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#9aa69f', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '6px 8px' }
const td: React.CSSProperties = { fontSize: 12.5, color: '#3a4640', padding: '6px 8px', borderTop: '1px solid #f0ece3', fontVariantNumeric: 'tabular-nums' }
const sect: React.CSSProperties = { background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, overflow: 'hidden', marginTop: 14 }
const sh: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid #f0ece3', fontSize: 12.5, fontWeight: 600, color: '#1f2d27', display: 'flex', alignItems: 'center', gap: 8 }

export function EncounterSandbox({ claims }: { claims: Claim[] }) {
  const [idx, setIdx] = useState(0)
  const [claim, setClaim] = useState<Claim>(claims[0])
  const [result, setResult] = useState<Adj | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEdi, setShowEdi] = useState(false)

  if (!claims.length) return <p style={{ fontSize: 13, color: '#9aa69f' }}>No encounters available.</p>

  const select = (i: number) => { setIdx(i); setClaim(claims[i]); setResult(null); setError(null); setShowEdi(false) }
  const setLine = (li: number, patch: Partial<Claim['lines'][number]>) =>
    setClaim((c) => ({ ...c, lines: c.lines.map((l, i) => (i === li ? { ...l, ...patch } : l)) }))

  async function submit() {
    setLoading(true); setError(null); setResult(null)
    try {
      const total = claim.lines.reduce((s, l) => s + (Number(l.billedCents) || 0), 0)
      const res = await fetch('/api/ehr/adjudicate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim: { ...claim, totalBilledCents: total } }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data as Adj)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  const r = result?.remittance
  const scrub = result?.scrub
  const total = claim.lines.reduce((s, l) => s + (Number(l.billedCents) || 0), 0)

  return (
    <div>
      {/* Patient selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {claims.map((c, i) => (
          <button key={c.controlNumber} onClick={() => select(i)} style={{
            fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid ' + (i === idx ? '#34685a' : '#ece7dd'), color: i === idx ? '#fff' : '#5a6b62',
            background: i === idx ? 'linear-gradient(135deg, #57997f 0%, #34685a 100%)' : '#fff',
          }}>
            {c.subscriber ? `${c.subscriber.firstName} ${c.subscriber.lastName}` : c.controlNumber}
          </button>
        ))}
      </div>

      {/* Editable encounter */}
      <div style={sect}>
        <div style={sh}>
          <span>Encounter — {claim.subscriber ? `${claim.subscriber.firstName} ${claim.subscriber.lastName}` : claim.controlNumber}</span>
          <span style={{ color: '#9aa69f', fontWeight: 400 }}>· {claim.payer.name} · {claim.dateOfService}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{fmt(total)}</span>
        </div>
        <div style={{ padding: '12px 14px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#7a8a80', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Diagnoses (ICD-10, comma-separated)</label>
          <input value={claim.diagnoses.join(', ')} onChange={(e) => setClaim((c) => ({ ...c, diagnoses: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ ...inp, marginTop: 5, marginBottom: 12 }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...th, width: '24%' }}>CPT / HCPCS</th><th style={{ ...th, width: '20%' }}>Modifiers</th>
              <th style={{ ...th, width: '14%' }}>Units</th><th style={{ ...th, width: '22%' }}>Charge $</th>
            </tr></thead>
            <tbody>
              {claim.lines.map((l, i) => (
                <tr key={i}>
                  <td style={td}><input value={l.cptHcpcs} onChange={(e) => setLine(i, { cptHcpcs: e.target.value.trim() })} style={inp} /></td>
                  <td style={td}><input value={l.modifiers.join(',')} onChange={(e) => setLine(i, { modifiers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="—" style={inp} /></td>
                  <td style={td}><input type="number" min={1} value={l.units} onChange={(e) => setLine(i, { units: Math.max(1, Number(e.target.value) || 1) })} style={inp} /></td>
                  <td style={td}><input type="number" min={0} step="0.01" value={(l.billedCents / 100).toString()} onChange={(e) => setLine(i, { billedCents: Math.round((Number(e.target.value) || 0) * 100) })} style={inp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={submit} disabled={loading} style={{
            marginTop: 14, fontSize: 13, fontWeight: 600, color: '#fff',
            background: loading ? '#9bb3a8' : 'linear-gradient(135deg, #57997f 0%, #34685a 100%)',
            border: 'none', borderRadius: 9, padding: '10px 18px', cursor: loading ? 'default' : 'pointer', boxShadow: '0 2px 8px rgba(52,104,90,0.25)',
          }}>
            {loading ? 'Submitting…' : 'Submit claim → 837 → adjudicate → 835 / EOB'}
          </button>
          {error && <div style={{ marginTop: 12, fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 9, padding: '10px 14px' }}>{error}</div>}
        </div>
      </div>

      {result && (
        <>
          {/* Scrub */}
          <div style={sect}>
            <div style={sh}>
              <span>1 · Scrub (pre-submission)</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: !scrub?.ok ? '#cf5547' : scrub.warningCount ? '#b8862a' : '#2f8a5b', background: !scrub?.ok ? '#fae9e6' : scrub?.warningCount ? '#f6efdd' : '#e6f4ec' }}>
                {!scrub?.ok ? 'blocked' : scrub.warningCount ? `${scrub.warningCount} warning${scrub.warningCount === 1 ? '' : 's'}` : 'clean'}
              </span>
            </div>
            {(scrub?.warnings?.length || scrub?.errors?.length) ? (
              <ul style={{ margin: 0, padding: '10px 14px 12px 30px', fontSize: 12.5, color: '#5a6b62', lineHeight: 1.6 }}>
                {scrub?.errors?.map((w, i) => <li key={'e' + i} style={{ color: '#cf5547' }}>{w.code ? w.code + ': ' : ''}{w.message}</li>)}
                {scrub?.warnings?.map((w, i) => <li key={'w' + i}>{w.code ? w.code + ': ' : ''}{w.message}</li>)}
              </ul>
            ) : <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#9aa69f' }}>No edits flagged.</div>}
          </div>

          {/* 837 */}
          <div style={sect}>
            <div style={sh}>
              <span>2 · 837 — claim submitted</span>
              {result.edi837 && <button onClick={() => setShowEdi((v) => !v)} style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#34685a', background: 'none', border: 'none', cursor: 'pointer' }}>{showEdi ? 'Hide raw EDI' : 'View raw 837 EDI'}</button>}
            </div>
            {showEdi && result.edi837 && (
              <pre style={{ margin: 0, padding: '12px 14px', fontSize: 11, lineHeight: 1.5, color: '#3a4640', background: '#faf8f4', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'DM Mono, monospace' }}>{result.edi837}</pre>
            )}
            {!showEdi && <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#5a6b62' }}>Real X12 837P generated for {claim.lines.length} line{claim.lines.length === 1 ? '' : 's'} ({fmt(total)}). {result.edi837 ? 'Click "View raw 837 EDI".' : 'EDI unavailable for this edit.'}</div>}
          </div>

          {/* 835 / EOB */}
          <div style={sect}>
            <div style={sh}><span>3 · 835 / ERA — the payer&apos;s EOB</span>{r && <span style={{ marginLeft: 'auto', color: '#9aa69f', fontWeight: 400, fontSize: 11.5 }}>status {r.claimStatusCode}</span>}</div>
            {r ? (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>CPT</th><th style={{ ...th, textAlign: 'right' }}>Billed</th><th style={{ ...th, textAlign: 'right' }}>Allowed</th>
                    <th style={{ ...th, textAlign: 'right' }}>Insurance paid</th><th style={{ ...th, textAlign: 'right' }}>Patient owes</th><th style={th}>Adjustments</th>
                  </tr></thead>
                  <tbody>
                    {r.lines.map((l, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontFamily: 'DM Mono, monospace' }}>{l.cptHcpcs}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmt(l.billedCents)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmt(l.allowedCents)}</td>
                        <td style={{ ...td, textAlign: 'right', color: '#2f8a5b', fontWeight: 600 }}>{fmt(l.paidCents)}</td>
                        <td style={{ ...td, textAlign: 'right', color: l.patientRespCents > 0 ? '#b8862a' : '#9aa69f' }}>{fmt(l.patientRespCents)}</td>
                        <td style={{ ...td, fontSize: 11.5 }}>{l.adjustments.length ? l.adjustments.map((a) => `${a.groupCode}·${a.carcCode} ${fmt(a.amountCents)}`).join('  ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '11px 14px', borderTop: '1px solid #ece7dd', background: '#f3f8f5', fontSize: 12.5, color: '#1f2d27', lineHeight: 1.6 }}>
                  <strong>EOB:</strong> billed <strong>{fmt(r.totalBilledCents)}</strong> · insurance paid <strong style={{ color: '#2f8a5b' }}>{fmt(r.totalPaidCents)}</strong> · patient responsibility <strong style={{ color: '#b8862a' }}>{fmt(r.patientRespCents)}</strong>.
                  <span style={{ color: '#6b7280' }}> CO = contractual write-off · PR = patient (deductible / copay / coinsurance).</span>
                </div>
              </>
            ) : <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#9aa69f' }}>No remittance produced.</div>}
          </div>

          {/* Found money */}
          <div style={sect}>
            <div style={sh}><span>4 · Found money</span><span style={{ marginLeft: 'auto', color: result.findings.length ? '#2f8a5b' : '#9aa69f', fontWeight: 700 }}>{fmt(result.findings.reduce((s, f) => s + f.recoverableCents, 0))} recoverable</span></div>
            {result.findings.length ? (
              <ul style={{ margin: 0, padding: '10px 14px 12px 30px', fontSize: 12.5, color: '#3a4640', lineHeight: 1.65 }}>
                {result.findings.map((f, i) => (
                  <li key={i}>
                    <strong style={{ textTransform: 'capitalize' }}>{f.type}</strong> on {f.cptHcpcs}{f.carcCode ? ` (CARC ${f.carcCode})` : ''} — <strong style={{ color: '#2f8a5b' }}>{fmt(f.recoverableCents)}</strong>{f.appealable ? ' · appealable' : ''}. <span style={{ color: '#6b7280' }}>{f.reason}</span>
                  </li>
                ))}
              </ul>
            ) : <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#9aa69f' }}>Paid as contracted — nothing to recover on this claim.</div>}
          </div>
        </>
      )}
    </div>
  )
}
