// app/approvals/page.tsx
import Link from 'next/link'
import { requireRole } from '@/lib/authz'
import { formatAmount } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    q?: string
    department?: string
    sort?: string
    status?: string
  }>
}

type ApprovalStatus = 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

function getTypeName(row: {
  request_types?: { name?: string } | { name?: string }[] | null
}) {
  if (Array.isArray(row.request_types)) {
    return row.request_types[0]?.name ?? '-'
  }
  return row.request_types?.name ?? '-'
}

export default async function ApprovalsPage({ searchParams }: Props) {
  const { supabase, profile } = await requireRole(['APPROVER', 'ADMIN'])
  const resolved = await searchParams

  const isAdmin = profile.role === 'ADMIN'
  const q = (resolved.q ?? '').trim()
  const department = isAdmin ? (resolved.department ?? '').trim() : ''
  const sort = resolved.sort === 'oldest' ? 'oldest' : 'newest'
  const status = (resolved.status ?? 'SUBMITTED').trim() as ApprovalStatus

  const heading =
    status === 'SUBMITTED'
      ? isAdmin
        ? '承認待ち（全件）'
        : `承認待ち（${profile.department}）`
      : `承認一覧（${status}）`

  let query = supabase
    .from('requests')
    .select('id, title, status, department, created_at, amount, needed_by, request_types(name)')

  if (status) {
    query = query.eq('status', status)
  }

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  if (isAdmin && department) {
    query = query.eq('department', department)
  }

  query = query.order('created_at', { ascending: sort === 'oldest' })

  const { data: rows, error } = await query

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-red-600">
        承認一覧の取得エラー: {error.message}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{heading}</h1>
        <Link href="/dashboard" className="underline text-sm">
          ダッシュボードへ
        </Link>
      </div>

      <form className="card grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="approvals-q" className="label">
            キーワード
          </label>
          <input
            id="approvals-q"
            name="q"
            className="input"
            defaultValue={q}
            placeholder="タイトルで検索"
          />
        </div>

        <div>
          <label htmlFor="approvals-status" className="label">
            ステータス
          </label>
          <select id="approvals-status" name="status" className="input" defaultValue={status}>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="RETURNED">RETURNED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div>
          <label htmlFor="approvals-sort" className="label">
            並び順
          </label>
          <select id="approvals-sort" name="sort" className="input" defaultValue={sort}>
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </div>

        {isAdmin && (
          <div>
            <label htmlFor="approvals-department" className="label">
              部署
            </label>
            <input
              id="approvals-department"
              name="department"
              className="input"
              defaultValue={department}
              placeholder="部署で絞り込み"
            />
          </div>
        )}

        <div className={`${isAdmin ? 'sm:col-span-3' : 'sm:col-span-4'} flex gap-2`}>
          <button type="submit" className="btn btn-primary">
            絞り込む
          </button>
          <Link href="/approvals" className="btn btn-secondary">
            リセット
          </Link>
        </div>
      </form>

      <div className="space-y-2">
        {(rows ?? []).map((r) => (
          <Link key={r.id} href={`/requests/${r.id}`} className="block card hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-2">
                <div className="font-medium">{r.title}</div>
                <div className="flex gap-2 flex-wrap text-xs text-gray-600">
                  <span className="chip">{r.status}</span>
                  <span className="chip">部署: {r.department}</span>
                  <span className="chip">種別: {getTypeName(r)}</span>
                  <span className="chip">金額: {formatAmount(r.amount)}</span>
                  <span className="chip">希望日: {r.needed_by ?? '-'}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 min-w-[160px] text-right">
                {new Date(r.created_at).toLocaleString('ja-JP')}
              </div>
            </div>
          </Link>
        ))}
        {(rows ?? []).length === 0 && (
          <div className="text-sm text-gray-600">条件に一致する申請はありません。</div>
        )}
      </div>
    </div>
  )
}