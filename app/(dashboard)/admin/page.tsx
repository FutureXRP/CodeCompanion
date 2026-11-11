import { readModuleFlags } from '@/lib/admin/server'
import { isNeonConfigured } from '@/lib/db/config'
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
        <strong>Admin</strong> stays pinned so you can always get back here. Running alongside a
        practice-management system, turn off whatever it already provides. On Tebra, which submits claims,
        posts ERAs and bills patients, one click with the <em>Tebra (PM runs billing)</em> preset keeps the
        Tebra loop — Front Desk, Pre-approval Review, Found Money, Posting Workbench, Follow-up Queue,
        Scorecard, EHR Pull — and switches the rest off. An EHR that runs billing but nothing else (athena) is the{' '}
        <em>Clinical only</em> preset; an EHR that handles the clinical side is <em>Billing &amp; RCM only</em>.
      </p>
      <AdminPanel initial={flags} persisted={isNeonConfigured()} />
    </div>
  )
}
