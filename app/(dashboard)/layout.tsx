import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { isSupabaseConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = isSupabaseConfigured()
  let userEmail: string | null = null

  // When Supabase is configured the platform requires a login; without it the
  // synthetic demo stays open (so a zero-config Vercel deploy still works).
  if (authEnabled) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    userEmail = user.email ?? null
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fb' }}>
      <Sidebar authEnabled={authEnabled} userEmail={userEmail} />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
