// app/api/auth/update-email/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

function isLikelySameSite(req: Request): boolean {
  // Refererが無いケースもある（ブラウザ設定/一部環境/preview）
  const ref = req.headers.get('referer')
  if (!ref) return true

  try {
    const refUrl = new URL(ref)
    const reqUrl = new URL(req.url)
    return refUrl.host === reqUrl.host
  } catch {
    return true
  }
}

export async function POST(req: Request) {
  // 軽いSame-siteチェック（Origin allowlistは持たない）
  if (!isLikelySameSite(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // JSONのみ受け付け
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'invalid content-type' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  // ログイン必須（cookieセッション）
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const newEmail = String(body?.newEmail ?? '').trim().toLowerCase()
  if (!newEmail) {
    return NextResponse.json({ error: 'newEmail is required' }, { status: 400 })
  }

  // 研修用のダミーは禁止（残っててもOKだが、ここで締める）
  if (newEmail.endsWith('@local.internal')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Supabaseの仕様上、確認メールが飛ぶ（設定による）
  return NextResponse.json({ ok: true })
}
