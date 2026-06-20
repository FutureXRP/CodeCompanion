import Link from 'next/link'
import { MODULE_BY_ID } from '@/lib/admin/modules'

export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'
const SAGE = '#3f7d6a'

export default async function ModuleOffPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams
  const mod = m ? MODULE_BY_ID.get(m) : undefined
  const label = mod?.label ?? 'This section'

  return (
    <div style={{ padding: '90px 40px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ width: 58, height: 58, borderRadius: 16, background: '#e7f0eb', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v8" stroke={SAGE} strokeWidth="2" strokeLinecap="round" />
          <path d="M6.5 7a8 8 0 1011 0" stroke={SAGE} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: '0 0 8px', letterSpacing: '-0.02em' }}>{label} is turned off</h1>
      <p style={{ fontSize: 13.5, color: SUB, margin: '0 auto', maxWidth: 420, lineHeight: 1.6 }}>
        An administrator has disabled this module{mod?.delegable ? ' — it may be handled in your EHR (e.g. Athena) instead' : ''}.
        Turn it back on in <strong>Admin → Module control</strong>.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26 }}>
        <Link href="/admin" style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #57997f 0%, #34685a 100%)', borderRadius: 10, padding: '10px 20px', textDecoration: 'none' }}>Open Admin</Link>
        <Link href="/command" style={{ fontSize: 13.5, fontWeight: 600, color: SAGE, background: '#fff', border: '1px solid #cfe0d8', borderRadius: 10, padding: '10px 20px', textDecoration: 'none' }}>Back to Command Center</Link>
      </div>
    </div>
  )
}
