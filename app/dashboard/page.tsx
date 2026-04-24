// app/dashboard/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/authz'
import { canCreateRequest } from '@/lib/permissions'
import { formatAmount } from '@/lib/format'

export const dynamic = 'force-dynamic'

type RequestRow = {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  amount: number | null
  created_at: string
}

function startOfDaysAgo(days: number) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  now.setDate(now.getDate() - days + 1)
  return now
}

function sumAmount(rows: RequestRow[]) {
  return rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
}

function sumApprovedAmount(rows: RequestRow[]) {
  return rows.reduce((sum, row) => {
    if (row.status !== 'APPROVED') return sum
    return sum + (row.amount ?? 0)
  }, 0)
}

function countByStatus(rows: RequestRow[], status: RequestRow['status']) {
  return rows.filter((row) => row.status === status).length
}

function StatCard(props: {
  title: string
  count: number
  totalAmount: number
  approvedAmount: number
}) {
  const { title, count, totalAmount, approvedAmount } = props

  return (
    <div className="card space-y-2">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl sm:text-3xl font-bold">{count}件</div>
      <div className="text-sm text-gray-700 break-words">
        金額合計: {formatAmount(totalAmount)}
      </div>
      <div className="text-sm text-gray-700 break-words">
        承認済み金額: {formatAmount(approvedAmount)}
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile()

  const isAdmin = profile.role === 'ADMIN'
  const isApprover = profile.role === 'APPROVER'
  const canCreate = canCreateRequest(profile.role)

  const { data: rows, error } = await supabase
    .from('requests')
    .select('id, status, amount, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-red-600">
        ダッシュボード集計エラー: {error.message}
      </div>
    )
  }

  const allRows = (rows ?? []) as RequestRow[]
  const start7 = startOfDaysAgo(7)
  const start30 = startOfDaysAgo(30)

  const last7Rows = allRows.filter((row) => new Date(row.created_at) >= start7)
  const last30Rows = allRows.filter((row) => new Date(row.created_at) >= start30)

  const pendingCount = countByStatus(allRows, 'SUBMITTED')
  const returnedCount = countByStatus(allRows, 'RETURNED')
  const approvedCount = countByStatus(allRows, 'APPROVED')

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">申請・承認ダッシュボード</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700">
          <div className="card">名前: {profile.name}</div>
          <div className="card">ロール: {profile.role}</div>
          <div className="card">部署: {profile.department}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="直近7日"
          count={last7Rows.length}
          totalAmount={sumAmount(last7Rows)}
          approvedAmount={sumApprovedAmount(last7Rows)}
        />
        <StatCard
          title="直近30日"
          count={last30Rows.length}
          totalAmount={sumAmount(last30Rows)}
          approvedAmount={sumApprovedAmount(last30Rows)}
        />
        <StatCard
          title="全期間"
          count={allRows.length}
          totalAmount={sumAmount(allRows)}
          approvedAmount={sumApprovedAmount(allRows)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card space-y-1">
          <div className="text-sm text-gray-500">承認待ち</div>
          <div className="text-2xl sm:text-3xl font-bold">{pendingCount}件</div>
        </div>
        <div className="card space-y-1">
          <div className="text-sm text-gray-500">差し戻し</div>
          <div className="text-2xl sm:text-3xl font-bold">{returnedCount}件</div>
        </div>
        <div className="card space-y-1">
          <div className="text-sm text-gray-500">承認済み</div>
          <div className="text-2xl sm:text-3xl font-bold">{approvedCount}件</div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="font-semibold">メニュー</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Link href="/requests" className="btn btn-secondary justify-center">
            申請一覧
          </Link>

          {canCreate && (
            <Link href="/requests/new" className="btn btn-secondary justify-center">
              新規申請（下書き）
            </Link>
          )}

          {(isApprover || isAdmin) && (
            <Link href="/approvals" className="btn btn-secondary justify-center">
              承認待ち
            </Link>
          )}

          {isAdmin && (
            <Link href="/admin" className="btn btn-secondary justify-center">
              管理
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}