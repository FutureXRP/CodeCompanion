import { readModuleFlags } from '@/lib/admin/server'
import { isSupabaseConfigured } from '@/lib/db/config'
import { AdminPanel } from '@/components/admin/AdminPanel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'

export default async function AdminPage() {
  const flags = await readModuleFlags()
  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, margin: 0, letterSpacing: '-0.03em' }}>Admin</h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3f7d6a', background: '#e7f0eb', padding: '3px 10px', borderRadius: 999 }}>Module control</span>
      </div>
      <p style={{ fontSize: 13.5, color: SUB, margin: '0 0 22px', maxWidth: 700, lineHeight: 1.55 }}>
        Switch any section of the platform on or off — you own the backend, and only{' '}
        <strong>Admin</strong> stays pinned so you can always get back here. Running alongside an EHR,
        turn off whatever it already provides. An EHR like Athena runs billing itself and won&apos;t allow a
        third-party biller, so on integration you switch the entire{' '}
        <strong>Billing &amp; RCM</strong> group off — one click with the{' '}
        <em>Clinical only</em> preset. If instead your EHR handles the clinical side, use{' '}
        <em>Billing &amp; RCM only</em>.
      </p>
      <AdminPanel initial={flags} persisted={isSupabaseConfigured()} />
    </div>
  )
}
