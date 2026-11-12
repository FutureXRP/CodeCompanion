import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { isLoginRequired, isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { readModuleFlags } from '@/lib/admin/server'
import { disabledIds } from '@/lib/admin/flags'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = isSupabaseConfigured()
  let userEmail: string | null = null

  // With Supabase configured, a signed-in user is recognized (their email, their
  // stored tenant data). Visitors are turned away only when the login gate is on
  // — REQUIRE_LOGIN=true, or always with ALLOW_REAL_PHI=true. While the practice
  // runs on synthetic data the gate is off, and an unreachable or broken auth
  // project must never take the pages down with it.
  if (authEnabled) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userEmail = user?.email ?? null
      if (!user && isLoginRequired()) redirect('/login')
    } catch (e) {
      // redirect() signals by throwing — let it through; swallow only auth failures.
      if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e
      if (typeof (e as { digest?: unknown })?.digest === 'string' && String((e as { digest: string }).digest).startsWith('NEXT_REDIRECT')) throw e
      if (isLoginRequired()) redirect('/login')
    }
  }

  const flags = await readModuleFlags()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f7f5f0' }}>
      <Sidebar authEnabled={authEnabled} userEmail={userEmail} disabledModules={disabledIds(flags)} />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
