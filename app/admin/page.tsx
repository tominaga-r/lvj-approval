// app/admin/page.tsx
import { requireRole } from '@/lib/authz'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { supabase } = await requireRole(['ADMIN'])

  const { data: requestTypes, error: rtErr } = await supabase
    .from('request_types')
    .select('id, name, created_at')
    .order('id', { ascending: true })

  if (rtErr) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-red-600">
        request_types取得エラー: {rtErr.message}
      </div>
    )
  }

  // ユーザー一覧（ADMIN は全員見える想定）
  const { data: users, error: uErr } = await supabase
    .from('profiles')
    .select('id, name, role, department, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (uErr) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-red-600">
        profiles取得エラー: {uErr.message}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">管理（ADMIN）</h1>
      <AdminClient requestTypes={requestTypes ?? []} users={users ?? []} />
    </div>
  )
}