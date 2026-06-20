import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withTenant, withService } from '@/lib/db/sql'
import { resolveTenantId } from '@/lib/db/tenant'
import { setFeatureFlags } from '@/lib/db/flags-repo'
import { FLAGS_COOKIE } from '@/lib/admin/server'
import { applyPreset, PRESETS, parseOverrides, resolveFlags, serializeOverrides, type FlagMap, type PresetId } from '@/lib/admin/flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const store = await cookies()
  return NextResponse.json({ flags: resolveFlags(parseOverrides(store.get(FLAGS_COOKIE)?.value)) })
}

export async function POST(request: Request) {
  const store = await cookies()
  const current = resolveFlags(parseOverrides(store.get(FLAGS_COOKIE)?.value))
  const body = (await request.json().catch(() => ({}))) as { moduleId?: string; enabled?: boolean; preset?: PresetId }

  let next: FlagMap
  if (body.preset && body.preset in PRESETS) {
    next = applyPreset(body.preset)
  } else if (body.moduleId && typeof body.enabled === 'boolean') {
    next = { ...current, [body.moduleId]: body.enabled }
  } else {
    return NextResponse.json({ error: 'Provide { moduleId, enabled } or { preset }.' }, { status: 400 })
  }
  const flags = resolveFlags(next) // re-apply the locked-always-on rule

  // Durable per-tenant persistence when wired (best-effort + audited); the cookie
  // stays the runtime source of truth so the demo works with zero infra.
  if (isNeonConfigured()) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const tenantId = await withService((db) => resolveTenantId(db, user.id))
        if (tenantId) await withTenant(tenantId, (db) => setFeatureFlags(db, tenantId, user.id, flags))
      }
    } catch { /* keep the cookie even if the DB write fails */ }
  }

  const res = NextResponse.json({ flags })
  res.cookies.set(FLAGS_COOKIE, serializeOverrides(flags), { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  return res
}
