'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MODULES, MODULE_GROUPS } from '@/lib/admin/modules'
import { PRESETS, type FlagMap, type PresetId } from '@/lib/admin/flags'

const INK = '#1f2d27', SUB = '#65726b', FAINT = '#9aa69f', LINE = '#ece7dd', SAGE = '#3f7d6a', GOLD = '#b8862a'

function Switch({ on, locked, onChange }: { on: boolean; locked?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{ width: 40, height: 23, borderRadius: 999, border: 'none', cursor: locked ? 'default' : 'pointer', background: on ? SAGE : '#d8d2c5', position: 'relative', transition: 'background .15s', opacity: locked ? 0.45 : 1, flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2.5, left: on ? 19 : 2.5, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s ease', boxShadow: '0 1px 2px rgba(31,45,39,.25)' }} />
    </button>
  )
}

export function AdminPanel({ initial, persisted }: { initial: FlagMap; persisted: boolean }) {
  const [flags, setFlags] = useState<FlagMap>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function apply(body: { moduleId?: string; enabled?: boolean; preset?: PresetId }, optimistic?: FlagMap) {
    const prev = flags
    if (optimistic) setFlags(optimistic)
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/admin/flags', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      setFlags(data.flags as FlagMap)
      router.refresh() // re-render the nav (server reads the new cookie)
    } catch (e) {
      setFlags(prev)
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }
  const toggle = (id: string, enabled: boolean) => apply({ moduleId: id, enabled }, { ...flags, [id]: enabled })

  const enabledCount = MODULES.filter((m) => flags[m.id] !== false).length

  return (
    <div>
      {/* Presets + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(Object.keys(PRESETS) as PresetId[]).map((p, i) => (
            <button key={p} type="button" disabled={busy} onClick={() => apply({ preset: p })} title={PRESETS[p].desc}
              style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? '#fff' : SAGE, background: i === 0 ? 'linear-gradient(135deg, #57997f 0%, #34685a 100%)' : '#fff', border: i === 0 ? 'none' : `1px solid #cfe0d8`, borderRadius: 10, padding: '9px 16px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {PRESETS[p].label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12.5, color: SUB }}>
          {enabledCount} of {MODULES.length} modules on
          {persisted ? ' · saved to your account' : ' · saved to this browser'}
        </span>
      </div>

      {error && <div style={{ background: '#fae9e6', border: '1px solid #f3d9d3', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#cf5547', marginBottom: 16 }}>{error}</div>}

      {MODULE_GROUPS.map((g) => {
        const mods = MODULES.filter((m) => m.group === g.id)
        if (mods.length === 0) return null
        return (
          <div key={g.id} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '0 0 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: SAGE }}>{g.label}</span>
              <span style={{ fontSize: 12, color: FAINT }}>{g.blurb}</span>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
              {mods.map((m, i) => {
                const on = flags[m.id] !== false
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: i < mods.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{m.label}</span>
                        {m.delegable && <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, background: '#f6efdd', padding: '1px 7px', borderRadius: 999 }}>delegable</span>}
                        {m.locked && <span style={{ fontSize: 10, fontWeight: 700, color: SUB, background: '#f0ece3', padding: '1px 7px', borderRadius: 999 }}>always on</span>}
                      </div>
                      <p style={{ fontSize: 12, color: SUB, margin: '2px 0 0' }}>{m.desc}</p>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? SAGE : FAINT, width: 30, textAlign: 'right' }}>{m.locked ? '' : on ? 'On' : 'Off'}</span>
                    <Switch on={on} locked={m.locked} onChange={(v) => toggle(m.id, v)} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p style={{ fontSize: 11.5, color: FAINT, marginTop: 6, lineHeight: 1.5 }}>
        Turning a module off hides it from the sidebar immediately. The cockpit and system pages are always on. Changes persist
        {persisted ? ' to your account (per-tenant, audited).' : ' to this browser; sign in with Supabase configured to persist per-tenant.'}
      </p>
    </div>
  )
}
