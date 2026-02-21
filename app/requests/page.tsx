// app/requests/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const { supabase, profile } = await requireProfile()
  const canCreate = profile.role === 'REQUESTER' || profile.role === 'ADMIN'

  const { data: rows, error } = await supabase
    .from('requests')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-6 text-red-600">requests取得エラー: {error.message}</div>
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">申請一覧</h1>
        {canCreate && (
          <Link className="btn btn-secondary" href="/requests/new">
            新規申請
          </Link>
        )}
      </div>

      <div className="text-sm text-gray-600">
        あなたの部署: {profile.department} / ロール: {profile.role}
      </div>

      <div className="space-y-2">
        {(rows ?? []).map((r) => (
          <Link key={r.id} href={`/requests/${r.id}`} className="block card hover:bg-gray-50">
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-gray-500">
              {r.status} / {new Date(r.created_at).toLocaleString('ja-JP')}
            </div>
          </Link>
        ))}
        {(rows ?? []).length === 0 && <div className="text-sm text-gray-600">申請がありません。</div>}
      </div>
    </div>
  )
}