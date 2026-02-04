// app/api/auth/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const nextRaw = url.searchParams.get('next') ?? '/'
  //next（外部URLへ飛ばさない）
  const safeNext = nextRaw.startsWith('/') ? nextRaw : '/'

  // code がない場合はそのまま next へ
  if (!code) {
    return NextResponse.redirect(new URL(safeNext, url.origin))
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('exchangeCodeForSession error:', error)
    // リンク期限切れなど → ログイン画面へ
    return NextResponse.redirect(new URL('/login?error=auth', url.origin))
  }

  // 同期ページへ
  const confirmedUrl = new URL('/auth/confirmed', url.origin)
  confirmedUrl.searchParams.set('next', safeNext)

  // クライアント側にも確実に反映させるため hash にトークンを載せる（hash はサーバーに送られない）
  const session = data?.session
  if (session?.access_token && session?.refresh_token) {
    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'bearer',
      // expires_in が無い実装の保険
      expires_in: String((session as any).expires_in ?? 3600),
    })
    confirmedUrl.hash = hash.toString()
  }

  return NextResponse.redirect(confirmedUrl)
}
