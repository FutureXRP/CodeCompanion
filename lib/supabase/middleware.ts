import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session refresh + route protection for Supabase Auth.
 *
 * Degrades gracefully: with no Supabase env, this is a no-op so the synthetic
 * demo (and a zero-config Vercel deploy) keeps working with no login. Once the
 * URL + anon key are set, dashboard routes require an authenticated user.
 *
 * Resilience: getUser() is a network round-trip to Supabase on EVERY request. It
 * is raced against a timeout so a slow or unreachable Supabase can never hang the
 * edge middleware — which otherwise surfaces as a Vercel 504
 * MIDDLEWARE_INVOCATION_TIMEOUT and takes the whole app offline. On timeout the
 * request simply proceeds (no redirect); auth is re-checked on the next request.
 */

const PUBLIC_EXACT = new Set(['/'])
const PUBLIC_PREFIXES = ['/login', '/auth']
const GETUSER_TIMEOUT_MS = 3000

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Reject after `ms` so a hung network call never blocks the runtime. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('supabase-timeout')), ms)),
  ])
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response // demo mode — no auth configured

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { pathname } = request.nextUrl

  try {
    // IMPORTANT: do not run code between createServerClient and getUser() — it
    // refreshes the session token and must be the first auth call.
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), GETUSER_TIMEOUT_MS)

    if (!user && !isPublicPath(pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    if (user && pathname === '/login') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      redirectUrl.searchParams.delete('redirectTo')
      return NextResponse.redirect(redirectUrl)
    }
  } catch {
    // Supabase slow/unreachable — do NOT hang the edge middleware or bounce the
    // user to /login. Proceed; page-level auth re-checks on the next request.
  }

  return response
}
