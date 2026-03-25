// app/approvals/page.tsx
import Link from 'next/link'
import { requireRole } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const { supabase, profile } = await requireRole(['APPROVER', 'ADMIN'])
  
  const heading =
  profile.role === 'ADMIN'
    ? '承認待ち（全件）'
    : `承認待ち（${profile.department}）`

  const { data: rows, error } = await supabase
    .from('requests')
    .select('id, title, status, department, created_at')
    .eq('status', 'SUBMITTED')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-red-600">
        承認待ちの取得エラー: {error.message}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{heading}</h1>
        <Link href="/dashboard" className="underline text-sm">
          ダッシュボードへ
        </Link>
      </div>

      <div className="space-y-2">
        {(rows ?? []).map((r) => (
          <Link key={r.id} href={`/requests/${r.id}`} className="block card hover:bg-gray-50">
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-gray-600">
              {r.status} / {r.department} / {new Date(r.created_at).toLocaleString('ja-JP')}
            </div>
          </Link>
        ))}
        {(rows ?? []).length === 0 && (
          <div className="text-sm text-gray-600">承認待ちはありません。</div>
        )}
      </div>
    </div>
  )
}
