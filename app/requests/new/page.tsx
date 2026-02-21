// app/requests/new/page.tsx
import { NewRequestForm } from './request-form'
import { requireRole } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export default async function NewRequestPage() {
  const { supabase } = await requireRole(['REQUESTER', 'ADMIN'])

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