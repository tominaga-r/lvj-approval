// app/requests/new/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { NewRequestForm } from './request-form'

export const dynamic = 'force-dynamic'

export default async function NewRequestPage() {
  const supabase = await createSupabaseServerClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  // 申請種別マスタ取得（全員select可）
  const { data: types, error } = await supabase
    .from('request_types')
    .select('id, name')
    .order('id', { ascending: true })

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-red-600">
        request_types取得エラー: {error.message}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">新規申請（下書き作成）</h1>
      <NewRequestForm types={types ?? []} />
    </div>
  )
}
