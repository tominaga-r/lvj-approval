// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PREFIXES = ['/dashboard', '/requests', '/approvals', '/settings', '/admin']

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function buildCsp() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isDev = process.env.NODE_ENV !== 'production'

  let supabaseOrigin = ''
  if (supabaseUrl) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin
    } catch {
      supabaseOrigin = ''
    }
  }

  const connectSrc = ["'self'"]
  if (supabaseOrigin) connectSrc.push(supabaseOrigin)

  const scriptSrc = ["'self'", "'unsafe-inline'"]
  if (isDev) {
    scriptSrc.push("'unsafe-eval'")
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    "frame-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ')
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set('Content-Security-Policy', buildCsp())
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico'
  ) {
    return applySecurityHeaders(NextResponse.next())
  }

  if (!isProtectedPath(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  let res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  return applySecurityHeaders(res)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}