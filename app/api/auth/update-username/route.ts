// app/api/auth/update-username/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { z } from 'zod'
import { updateUsernameSchema } from '@/lib/validation'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // メール登録済みユーザーだけ許可
  const email = user.email ?? ''
  const hasRealEmail = !!email && !email.endsWith('@local.internal')

  if (!hasRealEmail) {
    return NextResponse.json(
      { error: 'メール登録済みユーザーのみ、ユーザー名を変更できます。' },
      { status: 403 }
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = updateUsernameSchema.safeParse(json)

  if (!parsed.success) {
    const details = z.flattenError(parsed.error)
    return NextResponse.json(
      { error: '無効なユーザー名です', details },
      { status: 400 }
    )
  }

  const { username } = parsed.data

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username })
    .eq('id', user.id)

  if (upsertError) {
    // 一意制約違反（username unique）の場合
    if ((upsertError as any).code === '23505') {
      return NextResponse.json(
        { error: 'そのユーザー名は既に使われています' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
