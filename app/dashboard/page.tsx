// app/dashboard/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/authz'
import { canCreateRequest } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { profile } = await requireProfile()

  const isAdmin = profile.role === 'ADMIN'
  const isApprover = profile.role === 'APPROVER'
  const canCreate = canCreateRequest(profile.role)

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">申請・承認ダッシュボード</h1>

      <div className="rounded border p-4 bg-white">
        <div>名前: {profile.name}</div>
        <div>ロール: {profile.role}</div>
        <div>部署: {profile.department}</div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link className="btn btn-primary" href="/requests">
          申請一覧
        </Link>

        {canCreate && (
          <Link className="btn btn-secondary" href="/requests/new">
            新規申請（下書き）
          </Link>
        )}

        {(isApprover || isAdmin) && (
          <Link className="btn btn-secondary" href="/approvals">
            承認待ち
          </Link>
        )}

        {isAdmin && (
          <Link className="btn btn-ghost" href="/admin">
            管理
          </Link>
        )}
      </div>
    </div>
  )
}