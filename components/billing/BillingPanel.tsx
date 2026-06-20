'use client'
import { useState } from 'react'
import { formatCents } from '@/lib/canonical'

const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const BLUE = '#3f7d6a' // sage primary

function safeStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

export interface StatementLineView {
  cptHcpcs?: string
  dateOfService?: string
  chargedCents: number
  insurancePaidCents: number
  adjustedCents: number
  patientRespCents: number
}
export interface BillingAccount {
  accountKey: string
  patientName?: string
  payerName?: string
  patientArCents: number
  standing: string
  lines: StatementLineView[]
}

type Method = 'card' | 'cash' | 'check' | 'ach'

export function BillingPanel({ accounts, totalPatientArCents }: { accounts: BillingAccount[]; totalPatientArCents: number }) {
  // Local balance overrides after a recorded payment (no DB in the demo).
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [open, setOpen] = useState<string | null>(accounts[0]?.accountKey ?? null)

  const collected = accounts.reduce((s, a) => s + Math.max(0, a.patientArCents - (balances[a.accountKey] ?? a.patientArCents)), 0)
  const outstanding = accounts.reduce((s, a) => s + (balances[a.accountKey] ?? a.patientArCents), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
        <Kpi label="Patient A/R" value={formatCents(outstanding)} sub={`${accounts.length} accounts`} />
        <Kpi label="Collected this session" value={formatCents(collected)} accent={GREEN} sub="mock — no real charge" />
        <Kpi label="Starting balance" value={formatCents(totalPatientArCents)} sub="before payments" />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
        {accounts.length === 0 && <div style={{ padding: 20, fontSize: 13, color: SUB }}>No patient balances outstanding.</div>}
        {accounts.map((a, i) => (
          <AccountRow
            key={a.accountKey}
            account={a}
            balance={balances[a.accountKey] ?? a.patientArCents}
            isOpen={open === a.accountKey}
            isLast={i === accounts.length - 1}
            onToggle={() => setOpen(open === a.accountKey ? null : a.accountKey)}
            onPaid={(newBalance) => setBalances((b) => ({ ...b, [a.accountKey]: newBalance }))}
          />
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: FAINT, marginTop: 16, lineHeight: 1.5 }}>
        Statements are derived deterministically from the ledger (the 835 already split the patient portion). Payments post through the
        provider abstraction — mock here; Stripe drops in behind it, gated by ALLOW_REAL_CHARGES. No real money moves in this demo.
      </p>
    </div>
  )
}

function AccountRow({ account, balance, isOpen, isLast, onToggle, onPaid }: {
  account: BillingAccount; balance: number; isOpen: boolean; isLast: boolean; onToggle: () => void; onPaid: (n: number) => void
}) {
  const [amount, setAmount] = useState((balance / 100).toFixed(2))
  const [method, setMethod] = useState<Method>('card')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const paid = balance <= 0

  async function record() {
    setLoading(true); setError(null); setMsg(null)
    try {
      const cents = Math.round(Number(amount) * 100)
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountKey: account.accountKey, amountCents: cents, method, patientName: account.patientName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      const newBalance = data?.account?.patientArCents ?? Math.max(0, balance - cents)
      onPaid(newBalance)
      setMsg(`${formatCents(cents)} recorded via ${method} · ${safeStr(data?.result?.transactionId).slice(0, 16)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${LINE}` }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: INK, margin: '0 0 2px' }}>{account.patientName ?? account.accountKey}</p>
          <p style={{ fontSize: 12, color: SUB, margin: 0 }}>{account.payerName ?? '—'}</p>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: paid ? GREEN : AMBER, background: paid ? '#e8f6ee' : '#fdf4e3', padding: '2px 9px', borderRadius: 999 }}>
          {paid ? 'Paid' : 'Patient owes'}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: paid ? GREEN : INK, minWidth: 84, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(balance)}</span>
        <span style={{ fontSize: 12, color: FAINT, width: 14, textAlign: 'center' }}>{isOpen ? '▾' : '▸'}</span>
      </div>

      {isOpen && (
        <div style={{ padding: '0 18px 16px', background: '#fafbfd' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead>
              <tr>
                {['Service', 'Date', 'Charged', 'Insurance', 'Adjusted', 'Patient'].map((h, i) => (
                  <th key={h} style={{ textAlign: i < 2 ? 'left' : 'right', fontSize: 10.5, fontWeight: 600, color: FAINT, padding: '8px 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {account.lines.map((l, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ fontSize: 12.5, color: INK, padding: '7px 10px', fontFamily: 'DM Mono, monospace' }}>{safeStr(l.cptHcpcs) || '—'}</td>
                  <td style={{ fontSize: 12.5, color: SUB, padding: '7px 10px' }}>{safeStr(l.dateOfService) || '—'}</td>
                  <td style={{ fontSize: 12.5, color: INK, padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(l.chargedCents)}</td>
                  <td style={{ fontSize: 12.5, color: SUB, padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(l.insurancePaidCents)}</td>
                  <td style={{ fontSize: 12.5, color: SUB, padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(l.adjustedCents)}</td>
                  <td style={{ fontSize: 12.5, color: AMBER, fontWeight: 600, padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(l.patientRespCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!paid && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: SUB, marginBottom: 4 }}>Amount</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 110, fontSize: 13, padding: '8px 10px', border: `1px solid #d7dee9`, borderRadius: 8, color: INK }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: SUB, marginBottom: 4 }}>Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value as Method)} style={{ fontSize: 13, padding: '8px 10px', border: `1px solid #d7dee9`, borderRadius: 8, color: INK, background: '#fff' }}>
                  <option value="card">Card</option><option value="cash">Cash</option><option value="check">Check</option><option value="ach">ACH</option>
                </select>
              </div>
              <button onClick={record} disabled={loading} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #57997f 0%, #34685a 100%)', border: 'none', borderRadius: 9, padding: '9px 18px', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          )}
          {msg && <p style={{ fontSize: 12, color: GREEN, margin: '10px 0 0' }}>✓ {msg}</p>}
          {error && <p style={{ fontSize: 12, color: '#c9302c', margin: '10px 0 0' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '15px 17px' }}>
      <p style={{ fontSize: 11, color: FAINT, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? INK, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: SUB, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}
