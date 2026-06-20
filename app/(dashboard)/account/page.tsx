import { redirect } from 'next/navigation'
import { isSupabaseConfigured, isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService } from '@/lib/db/sql'
import { resolveTenantId, loadTenantName } from '@/lib/db/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function AccountPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div style={{ padding: '34px 40px 48px', maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>Account</h1>
        <div style={{ marginTop: 16, background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 12, padding: '16px 18px', fontSize: 13.5, color: '#92400e', lineHeight: 1.55 }}>
          This deployment is running in <strong>demo mode</strong> — accounts aren&apos;t enabled. Set the Supabase
          environment variables to turn on login and accounts.
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The practice name lives in Neon now (Supabase is auth-only).
  let practiceName: string | null = null
  if (isNeonConfigured()) {
    try {
      const tenantId = await withService((db) => resolveTenantId(db, user.id))
      practiceName = tenantId ? await withService((db) => loadTenantName(db, tenantId)) : null
    } catch { /* demo / DB unavailable */ }
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Email', value: user.email ?? '—' },
    { label: 'Practice', value: practiceName ?? 'Provisioned on first save' },
    { label: 'Signed up', value: fmtDate(user.created_at) },
    { label: 'Last sign-in', value: fmtDate(user.last_sign_in_at) },
    { label: 'Auth method', value: user.app_metadata?.provider ?? 'email' },
    { label: 'Account ID', value: user.id, mono: true },
  ]

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 25, fontWeight: 600, color: INK, margin: '0 0 6px', letterSpacing: '-0.025em' }}>Account</h1>
      <p style={{ fontSize: 13.5, color: SUB, margin: '0 0 22px' }}>Your sign-in and practice details.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,21,32,0.04)', marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#e6efe9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#3f7d6a', textTransform: 'uppercase', flexShrink: 0 }}>
          {(user.email ?? '?').charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: INK, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          <p style={{ fontSize: 12.5, color: '#2f8a5b', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#34d399', display: 'inline-block' }} /> Signed in
          </p>
        </div>
        <form action="/auth/signout" method="post" style={{ margin: 0 }}>
          <button type="submit" style={{ fontSize: 13, fontWeight: 600, color: '#cf5547', background: '#fae9e6', border: '1px solid #f3d9d3', borderRadius: 9, padding: '9px 16px', cursor: 'pointer' }}>
            Sign out
          </button>
        </form>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 18px', borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : 'none' }}>
            <span style={{ fontSize: 13, color: FAINT, fontWeight: 500 }}>{r.label}</span>
            <span style={{ fontSize: 13, color: INK, fontFamily: r.mono ? 'DM Mono, monospace' : undefined, fontWeight: r.mono ? 400 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{r.value}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: FAINT, marginTop: 14, lineHeight: 1.5 }}>
        Your data is isolated to your practice by row-level security. Synthetic / de-identified data only until the BAA gate is closed.
      </p>
    </div>
  )
}
