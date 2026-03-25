// app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { z } from 'zod'
import { passwordResetSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = passwordResetSchema.safeParse(json)

  if (!parsed.success) {
    const details = z.flattenError(parsed.error)
    return NextResponse.json({ error: 'invalid_body', details }, { status: 400 })
  }

  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(req.url).origin

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    console.error('resetPasswordForEmail error:', error)

    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return NextResponse.json(
        {
          ok: false,
          error: 'メール送信回数の上限に達しました。時間をおいて再試行してください。',
          code: 'over_email_send_rate_limit',
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'password reset failed',
      },
      { status: error.status || 500 }
    )
  }

  return NextResponse.json({ ok: true })
}