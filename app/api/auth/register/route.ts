// app/api/auth/register/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { z } from 'zod'
import { registerSchema } from '@/lib/validation'
import { createClient } from '@supabase/supabase-js'

/**
 * ユーザー登録 API（匿名ユーザーのデータ引き継ぎ対応・安全版）
 *
 * - Service Role を使用（dynamic = force-dynamic）
 * - username の正規化と重複チェック
 * - 匿名ログの移行（「今のセッションの匿名ユーザー」からのみ）
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

// --- Origin チェック（本番だけ有効・Service Role 用）---
function isSameOrigin(req: Request): boolean {
  // dev / test 環境では Origin チェックをスキップ
  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  const origin = req.headers.get('origin')

  if (!origin) return false

  // 許可したい Origin 一覧
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL, // 本番
    'https://my-organize-app-git-main-tominagas-projects-2419b058.vercel.app', // Preview
  ].filter(Boolean) as string[]

  // どれか1つでも完全一致したらOK
  return allowedOrigins.some((o) => o === origin)
}

// --- 簡易レートリミッター（メモリ版） ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 5
const ipMap = new Map<string, { count: number; firstTs: number }>()

function isRateLimited(ip: string) {
  const now = Date.now()
  const rec = ipMap.get(ip)
  if (!rec) {
    ipMap.set(ip, { count: 1, firstTs: now })
    return false
  }
  if (now - rec.firstTs > RATE_LIMIT_WINDOW_MS) {
    ipMap.set(ip, { count: 1, firstTs: now })
    return false
  }
  rec.count++
  return rec.count > RATE_LIMIT_MAX
}

export async function POST(req: Request) {
  try {
    // --- Origin チェック ---
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // --- レート制限 ---
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    if (ip !== 'unknown' && isRateLimited(ip)) {
      return NextResponse.json(
        {
          error:
            'リクエストが多すぎます。少し時間をおいて再度お試しください。',
        },
        { status: 429 }
      )
    }

    // --- 入力バリデーション（zod） ---
    const json = await req.json().catch(() => null)
    const parsed = registerSchema.safeParse(json)

    if (!parsed.success) {
      const details = z.flattenError(parsed.error)
      return NextResponse.json(
        {
          error: '入力値が不正です',
          details,
        },
        { status: 400 }
      )
    }

    // anon_user_id は受け取るが信用しない（互換のためパースだけ）
    const { anon_user_id: _ignoredAnon, username, password, email } =
      parsed.data
    const normalizedUsername = username.trim()

    const supabaseAdmin = createSupabaseAdmin()
    const supabase = await createSupabaseServerClient()

    // --- 「今のセッションユーザー」が匿名かどうか判定 ---
    let anonUserId: string | null = null

    const {
      data: { user: sessionUser },
      error: sessionError,
    } = await supabase.auth.getUser()

    if (!sessionError && sessionUser) {
      const anyUser = sessionUser as any
      const looksAnonymous =
        anyUser?.is_anonymous === true || !sessionUser.email

      if (looksAnonymous) {
        anonUserId = sessionUser.id
      }
    }

    // --- username 重複チェック ---
    const { data: existingProfiles, error: profileCheckError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('username', normalizedUsername)
        .limit(1)

    if (profileCheckError) {
      console.error('プロフィール重複チェック失敗:', profileCheckError)
      return NextResponse.json(
        { error: 'ユーザー登録に失敗しました。' },
        { status: 500 }
      )
    }

    if (existingProfiles && existingProfiles.length > 0) {
      return NextResponse.json(
        { error: 'そのユーザー名は既に使われています。' },
        { status: 409 }
      )
    }

    // --- メールの扱い ---
    const cleanedEmail =
      email && email.trim().length > 0 ? email.trim() : null

    // ユーザー名から「ログイン用ID」を作る（英数と ._- のみ）
    const loginIdBase = normalizedUsername
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_') // 日本語などは "_" に
      .replace(/_+/g, '_') // "_" 連続を1個に
      .replace(/^_+|_+$/g, '') // 先頭・末尾の "_" を削る

    const loginId = loginIdBase || 'user_local'

    // Supabase に渡す email と email_confirm の決定
    let finalEmail: string
    let emailConfirmFlag: boolean

    if (cleanedEmail) {
      // 本物のメールアドレスあり → 未確認で作成（あとで自前でマジックリンク送信）
      finalEmail = cleanedEmail
      emailConfirmFlag = false
    } else {
      // メール未入力 → 擬似メール + 確認済み扱い（即ログインOK）
      finalEmail = `${loginId}@local.internal`
      emailConfirmFlag = true
    }

    // --- Supabase Auth ユーザー作成（Service Role） ---
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: finalEmail,
        password,
        email_confirm: emailConfirmFlag,
        user_metadata: { username: normalizedUsername },
      })

    if (createError || !created?.user) {
      console.error('ユーザー作成失敗:', createError)
      return NextResponse.json(
        {
          error: createError?.message ?? 'ユーザー作成に失敗しました。',
        },
        { status: 500 }
      )
    }

    const newUserId = created.user.id

    // --- profiles 作成 ---
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: newUserId, username: normalizedUsername })

    if (profileInsertError) {
      console.error('プロフィール作成失敗:', profileInsertError)
      return NextResponse.json(
        { error: 'プロフィール作成に失敗しました。' },
        { status: 500 }
      )
    }

    // --- 匿名ログの引き継ぎ ---
    // ※ ここで使う anonUserId は「サーバー側で判定した今のセッションの匿名ユーザーID」
    if (anonUserId) {
      const { error: moveError } = await supabaseAdmin
        .from('logs')
        .update({ user_id: newUserId })
        .eq('user_id', anonUserId)

      if (moveError) {
        console.error('匿名ログ移行失敗:', moveError)
        // ここは致命ではないのでユーザー自体は残す
      }

      // 匿名ユーザー削除（失敗しても致命ではない）
      await supabaseAdmin.auth.admin.deleteUser(anonUserId).catch((e) => {
        console.warn('匿名ユーザー削除失敗:', e)
      })
    }

    // --- 本物メールありの場合はマジックリンク送信 ---
    if (cleanedEmail) {
      const verifyClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false },
        }
      )

      const { error: otpError } = await verifyClient.auth.signInWithOtp({
        email: cleanedEmail,
        options: {
          // メールのリンク先 → /auth/confirm
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm?next=/`,
        },
      })

      if (otpError) {
        console.error('signInWithOtp (register) error:', otpError)
        return NextResponse.json(
          {
            error:
              otpError.message ??
              '確認メールの送信に失敗しました。',
          },
          { status: 500 }
        )
      }

      // 登録成功 + 確認メールフロー開始
      return NextResponse.json({
        ok: true,
        user_id: newUserId,
        mode: 'email_with_verification',
      })
    }

    // --- メール未入力（ダミー@local.internal）の場合 ---
    return NextResponse.json({
      ok: true,
      user_id: newUserId,
      mode: 'pseudo_email',
    })
  } catch (e: any) {
    console.error('登録処理中にエラー:', e)
    return NextResponse.json(
      { error: e?.message ?? '不明なエラーが発生しました。' },
      { status: 500 }
    )
  }
}
