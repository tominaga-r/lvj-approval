// app/api/auth/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { buildInternalRedirectUrl, normalizeInternalPath } from '@/lib/authFlow'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const code = url.searchParams.get('code')
  const next = normalizeInternalPath(url.searchParams.get('next'), '/dashboard')

  if (!code) {
    return NextResponse.redirect(buildInternalRedirectUrl(req.url, next, '/dashboard'))
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('exchangeCodeForSession error:', error)

    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('error', 'auth')
    return NextResponse.redirect(loginUrl)
  }

  const confirmedUrl = new URL('/auth/confirmed', url.origin)
  confirmedUrl.searchParams.set('next', next)

  return NextResponse.redirect(confirmedUrl)
}