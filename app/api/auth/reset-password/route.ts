// app/api/auth/reset-password/route.ts
// メール機能 ON にした場合に利用
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

  const origin = new URL(req.url).origin
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    console.error('resetPasswordForEmail error:', error)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}

// import { NextResponse } from 'next/server'
// import { createSupabaseServerClient } from '@/lib/supabaseServer'

// // キャッシュ禁止（なくていいかも）
// export const dynamic = 'force-dynamic'
// export const revalidate = 0

// export async function POST(req: Request) {
//   const { email } = await req.json()

//   if (!email) {
//     return NextResponse.json({ error: 'email required' }, { status: 400 })
//   }

//   const supabase = await createSupabaseServerClient()

//   const { error } = await supabase.auth.resetPasswordForEmail(email, {
//     redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password`,
//   })

//   if (error) {
//     return NextResponse.json({ error: error.message }, { status: 500 })
//   }

//   return NextResponse.json({ ok: true })
// }
