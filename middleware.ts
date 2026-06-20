import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { FLAGS_COOKIE, disabledIds, parseOverrides, resolveFlags } from '@/lib/admin/flags'

export async function middleware(request: NextRequest) {
  // 1. Auth/session refresh (Supabase). Honor any redirect it returns.
  const authResponse = await updateSession(request)
  if (authResponse.headers.has('location')) return authResponse

  // 2. Module guard: a direct URL to a turned-off module renders the "off" page
  //    instead, so disabling a module in Admin truly takes it offline (not just
  //    hidden from the nav). Locked modules are never disabled.
  const seg = request.nextUrl.pathname.split('/')[1]
  if (seg) {
    const off = new Set(disabledIds(resolveFlags(parseOverrides(request.cookies.get(FLAGS_COOKIE)?.value))))
    if (off.has(seg)) {
      const url = request.nextUrl.clone()
      url.pathname = '/module-off'
      url.searchParams.set('m', seg)
      const rewrite = NextResponse.rewrite(url, { request })
      authResponse.cookies.getAll().forEach((c) => rewrite.cookies.set(c)) // keep refreshed session cookies
      return rewrite
    }
  }
  return authResponse
}

export const config = {
  // Run on everything except static assets and /api (routes handle their own auth).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
