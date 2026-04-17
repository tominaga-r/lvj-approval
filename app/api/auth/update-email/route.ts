// app/api/auth/update-email/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { updateEmailSchema } from '@/lib/validation'
import { rejectIfNotJson, rejectIfNotLikelySameSite } from '@/lib/requestGuards'

export async function POST(req: Request) {
  const sameSiteError = rejectIfNotLikelySameSite(req)
  if (sameSiteError) return sameSiteError

  const jsonError = rejectIfNotJson(req)
  if (jsonError) return jsonError

  const supabase = await createSupabaseServerClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateEmailSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid body' },
      { status: 400 }
    )
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Supabaseの仕様上、確認メールが飛ぶ（設定）
  return NextResponse.json({ ok: true })
}