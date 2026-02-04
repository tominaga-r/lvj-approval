// app/api/themes/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  // 非表示テーマ一覧
  const { data: hiddenRows, error: hiddenError } = await supabase
    .from('hidden_filters')
    .select('value')
    .eq('user_id', user.id)
    .eq('kind', 'theme')

  if (hiddenError) {
    return NextResponse.json({ error: hiddenError.message }, { status: 500 })
  }

  const hiddenThemes = new Set((hiddenRows ?? []).map((r) => r.value))

  const { data, error } = await supabase
    .from('logs')
    .select('theme')
    .eq('user_id', user.id)
    .eq('is_hidden', false)

  if (error) {
    console.error('/api/themes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const themes = new Set<string>()

  for (const row of data ?? []) {
    if (row.theme === null) {
      themes.add('null') // 未分類テーマnullとして返す
    } else {
      const t = row.theme.trim()
      if (t.length > 0) themes.add(t)
    }
  }

  // 非表示テーマを除外して返す
  const visible = Array.from(themes).filter((t) => !hiddenThemes.has(t))
  return NextResponse.json(visible)
}






// import { NextResponse } from 'next/server'
// import { createSupabaseServerClient } from '@/lib/supabaseServer'

// export async function GET() {
//   const supabase = createSupabaseServerClient()

//   // --- ユーザー取得（Cookie から自動でセッション判定） ---
//   const {
//     data: { user },
//     error: userError,
//   } = await supabase.auth.getUser()

//   if (userError || !user) {
//     return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
//   }

//   // --- logs テーブルから theme を取得 ---
//   const { data, error } = await supabase
//     .from('logs')
//     .select('theme')
//     .eq('user_id', user.id)
//     .neq('theme', 'none')
//     .not('theme', 'is', null)
//     .order('theme', { ascending: true })

//   if (error) {
//     return NextResponse.json({ error: error.message }, { status: 500 })
//   }

//   // --- theme の重複を削除 ---
//   const uniqueThemes = Array.from(
//     new Set(data.map((d) => d.theme).filter(Boolean))
//   )

//   return NextResponse.json(uniqueThemes)
// }
