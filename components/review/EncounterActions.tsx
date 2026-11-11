'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Approve in Tebra / send back to the provider. Posts to the write-path route,
 * which is off unless TEBRA_ALLOW_WRITES=true (or the source is the mock).
 */
export function EncounterActions({ encounterId, verdict, source }: { encounterId: string; verdict: 'blocked' | 'fix' | 'opportunities' | 'ready'; source: 'mock' | 'live' }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'Approved' | 'Rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(status: 'Approved' | 'Rejected') {
    if (status === 'Approved' && verdict === 'blocked' && !confirm('This encounter will reject as coded. Approve anyway?')) return
    setBusy(status)
    setError(null)
    try {
      const res = await fetch('/api/ehr/tebra/encounter-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encounterId, status }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const btn = (label: string, status: 'Approved' | 'Rejected', primary: boolean) => (
    <button
      onClick={() => act(status)}
      disabled={busy !== null}
      style={{
        fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '7px 12px', cursor: busy ? 'default' : 'pointer',
        color: primary ? '#fff' : '#5a6b62',
        background: primary ? (busy ? '#9bb3a8' : 'linear-gradient(135deg, #57997f 0%, #34685a 100%)') : '#f0ece3',
        border: primary ? 'none' : '1px solid #e7e1d6',
      }}
    >
      {busy === status ? '…' : label}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {btn('Send back to provider', 'Rejected', false)}
      {btn(verdict === 'ready' ? 'Approve in Tebra' : 'Approve anyway', 'Approved', verdict !== 'blocked')}
      <span style={{ fontSize: 11, color: '#9aa69f' }}>{source === 'mock' ? 'mock — changes in-memory state only' : 'writes to Tebra · audited'}</span>
      {error && <span style={{ fontSize: 12, color: '#92400e' }}>{error}</span>}
    </div>
  )
}
