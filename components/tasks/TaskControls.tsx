'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'open' | 'in_progress' | 'done'

/** Status + owner controls for a stored task; saves through PATCH /api/tasks and refreshes the page. */
export function TaskControls({ id, status, assignee }: { id: string; status: Status; assignee: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [owner, setOwner] = useState(assignee ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save(patch: { status?: Status; assignee?: string | null }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input
        value={owner}
        placeholder="owner"
        onChange={(e) => setOwner(e.target.value)}
        onBlur={() => { if ((assignee ?? '') !== owner) void save({ assignee: owner || null }) }}
        disabled={busy}
        style={{ fontSize: 12, padding: '4px 7px', border: '1px solid #e7e1d6', borderRadius: 7, width: 110, color: '#3a4640', background: '#fff' }}
      />
      <select
        value={status}
        onChange={(e) => void save({ status: e.target.value as Status })}
        disabled={busy}
        style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #e7e1d6', borderRadius: 7, color: '#3a4640', background: '#fff' }}
      >
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
      {error && <span style={{ fontSize: 11, color: '#92400e' }}>{error}</span>}
    </div>
  )
}
