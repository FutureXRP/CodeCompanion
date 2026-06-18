'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const INK = '#16213a'
const SUB = '#5a6473'
const LINE = '#e9ecf2'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const supabase = createClient()
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '/dashboard'
        router.push(redirectTo)
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setNotice('Account created — check your email to confirm, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(900px 460px at 50% -160px, #eaf0ff 0%, rgba(234,240,255,0) 60%), #f8f9fb', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 396 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', textDecoration: 'none', marginBottom: 22 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(45,93,232,.3)' }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M4 3l-2.5 4 2.5 4M10 3l2.5 4-2.5 4M8 1l-2 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>PracticeCompanion</span>
        </Link>

        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, boxShadow: '0 8px 30px rgba(15,21,32,.06)', padding: '28px 26px' }}>
          <h1 style={{ fontSize: 19, fontWeight: 600, color: INK, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {mode === 'signin' ? 'Sign in' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 13, color: SUB, margin: '0 0 20px' }}>
            {mode === 'signin' ? 'Welcome back to your practice.' : 'Start recovering revenue your billing leaves behind.'}
          </p>

          {!CONFIGURED ? (
            <div style={{ fontSize: 13, color: '#92400e', background: '#fdf4e3', border: '1px solid #f6e0b5', borderRadius: 10, padding: '12px 14px', lineHeight: 1.5 }}>
              Authentication isn&apos;t configured for this deployment. This is the synthetic demo —
              explore it at <Link href="/dashboard" style={{ color: '#2d5de8', fontWeight: 600 }}>/dashboard</Link>. Set the Supabase
              environment variables to enable accounts.
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <label style={labelStyle}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={inputStyle} placeholder="you@practice.com" />
              <label style={labelStyle}>Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} style={inputStyle} placeholder="••••••••" />

              {error && <p style={{ fontSize: 12.5, color: '#c9302c', margin: '4px 0 0' }}>{error}</p>}
              {notice && <p style={{ fontSize: 12.5, color: '#1a7a45', margin: '4px 0 0' }}>{notice}</p>}

              <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 16, fontSize: 14, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', border: 'none', borderRadius: 10, padding: '11px 0', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.65 : 1, boxShadow: '0 4px 14px rgba(45,93,232,.22)' }}>
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              <p style={{ fontSize: 12.5, color: SUB, textAlign: 'center', margin: '16px 0 0' }}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null) }} style={{ background: 'none', border: 'none', color: '#2d5de8', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </form>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: '#9aa3b2', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
          Synthetic / de-identified data only · no PHI until the BAA gate is closed
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: INK, margin: '12px 0 5px' }
const inputStyle: React.CSSProperties = { width: '100%', fontSize: 14, color: INK, border: '1px solid #d7dde7', borderRadius: 9, padding: '10px 12px', outline: 'none', background: '#fff' }
