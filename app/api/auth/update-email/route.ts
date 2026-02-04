// app/api/auth/update-email/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { emailRequiredSchema } from '@/lib/validation'

// Next.js App Router 用
export const dynamic = 'force-dynamic'
export const revalidate = 0

// リクエストボディのバリデーション
const bodySchema = z.object({
  email: emailRequiredSchema,
  currentPassword: z.string().min(1, '現在のパスワードは必須です'),
})

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

  // どれか1つでも完全一致したらOK（URL.parse してホスト比較でも可）
  return allowedOrigins.some((o) => o === origin)
}

export async function POST(req: Request) {
  try {
    // --- Origin チェック ---
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'invalid_body',
        },
        { status: 400 }
      )
    }

    const { email: newEmail, currentPassword } = parsed.data

    const supabase = await createSupabaseServerClient()

    // --- ログイン中ユーザー取得 ---
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'not_authenticated' },
        { status: 401 }
      )
    }

    const currentEmail = user.email ?? ''
    if (!currentEmail) {
      // 匿名ユーザーはここに来ない想定だが、一応ガード
      return NextResponse.json(
        {
          error:
            'anonymous_user_cannot_change_email_from_here',
        },
        { status: 400 }
      )
    }

    // --- サーバー側で現在パスワードを再認証 ---
    const reauthClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false }, // セッションは保持しない（検証用途だけ）
      }
    )

    const { data: reauthData, error: reauthError } =
      await reauthClient.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      })

    if (reauthError || !reauthData.user) {
      // パスワード違い
      return NextResponse.json(
        { error: 'wrong_password' },
        { status: 401 }
      )
    }

    // 念のためユーザーIDも一致確認
    if (reauthData.user.id !== user.id) {
      return NextResponse.json(
        { error: 'user_mismatch' },
        { status: 403 }
      )
    }

    const isPseudo = currentEmail.endsWith('@local.internal')

    if (isPseudo) {
      // --- ダミーメール → 本物メール + 自前確認メール ---

      // admin でメールだけ書き換え（Secure email change を回避）
      const admin = createSupabaseAdmin()
      const { error: adminError } =
        await admin.auth.admin.updateUserById(user.id, {
          email: newEmail,
          email_confirm: false, // ここは false にしておいて、自前フローで確認
        })

      if (adminError) {
        console.error('admin.updateUserById error:', adminError)
        return NextResponse.json(
          {
            error:
              adminError.message ?? 'メール更新に失敗しました',
          },
          { status: 500 }
        )
      }

      // 新しいメールアドレスにだけマジックリンク送信
      const verifyClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false },
        }
      )

      const { error: otpError } = await verifyClient.auth.signInWithOtp({
        email: newEmail,
        options: {
          // リンクを踏んだあとに飛ばしたいURL
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm?next=/settings`,
        },
      })

      if (otpError) {
        console.error('signInWithOtp error:', otpError)
        return NextResponse.json(
          {
            error:
              otpError.message ??
              '確認メールの送信に失敗しました',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        mode: 'pseudo_to_real',
      })
    } else {
      // --- 通常ユーザーのメール変更（Supabase の標準フロー） ---
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      })

      if (error) {
        console.error('updateUser error:', error)
        return NextResponse.json(
          { error: error.message ?? 'メール更新に失敗しました' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        ok: true,
        mode: 'normal_change',
      })
    }
  } catch (e: any) {
    console.error('update-email route error:', e)
    return NextResponse.json(
      { error: e?.message ?? 'メール更新中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
