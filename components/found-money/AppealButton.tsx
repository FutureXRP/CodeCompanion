'use client'
import { useState } from 'react'

interface AppealResponse {
  letter: string
  mode: 'llm' | 'template'
  model?: string
  note?: string
}

export function AppealButton({ findingId, kind }: { findingId: string; kind: 'denial' | 'underpayment' }) {
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<AppealResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const label = kind === 'denial' ? 'Draft appeal' : 'Draft request'

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/appeals/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ findingId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Request failed')
      setDraft(data as AppealResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to draft')
    } finally {
      setLoading(false)
    }
  }

  function close() {
    setDraft(null)
    setError(null)
    setCopied(false)
  }

  return (
    <>
      <button
        onClick={generate}
        disabled={loading}
        style={{
          fontSize: 12, fontWeight: 600, color: '#3f7d6a', cursor: loading ? 'default' : 'pointer',
          background: '#e7f0eb', border: '1px solid #d6e2da', borderRadius: 7, padding: '4px 10px',
          opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Drafting…' : label}
      </button>

      {error && <span style={{ color: '#cf5547', fontSize: 12, marginLeft: 8 }}>{error}</span>}

      {draft && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,21,32,0.45)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(720px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(15,21,32,0.25)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2d27' }}>
                  {kind === 'denial' ? 'Appeal letter' : 'Reprocessing request'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: draft.mode === 'llm' ? '#e7f6ee' : '#f0ece3', color: draft.mode === 'llm' ? '#2f8a5b' : '#6b7280' }}>
                  {draft.mode === 'llm' ? `AI draft${draft.model ? ` · ${draft.model}` : ''}` : 'Template'}
                </span>
              </div>
              <button onClick={close} style={{ fontSize: 18, color: '#9aa69f', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <textarea
              readOnly
              value={draft.letter}
              style={{ flex: 1, minHeight: 320, margin: 0, padding: '14px 18px', border: 'none', resize: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.55, color: '#3a4640', outline: 'none' }}
            />

            <div style={{ padding: '12px 18px', borderTop: '1px solid #f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#9aa69f', flex: 1 }}>
                {draft.note ?? 'Review before sending. Dollar figures come from the deterministic diff, not the model.'}
              </span>
              <button
                onClick={async () => { await navigator.clipboard.writeText(draft.letter); setCopied(true) }}
                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#3f7d6a', border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer' }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
