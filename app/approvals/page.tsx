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
    from?: string
    to?: string
    mine?: string
    hasComment?: string
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

function toDateStart(value: string) {
  return `${value}T00:00:00.000+09:00`
}

function toNextDateStart(value: string) {
  const base = new Date(`${value}T00:00:00+09:00`)
  base.setDate(base.getDate() + 1)
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00.000+09:00`
}

function hasAnyComment(
  row: {
    request_actions?: { comment?: string | null }[] | null
  }
) {
  return (row.request_actions ?? []).some((a) => {
    const comment = a.comment?.trim() ?? ''
    return comment.length > 0
  })
}

function countByStatus<T extends { status: string }>(rows: T[], status: string) {
  return rows.filter((r) => r.status === status).length
}

export default async function ApprovalsPage({ searchParams }: Props) {
  const { supabase, profile } = await requireRole(['APPROVER', 'ADMIN'])
  const resolved = await searchParams

  const isAdmin = profile.role === 'ADMIN'
  const q = (resolved.q ?? '').trim()
  const department = isAdmin ? (resolved.department ?? '').trim() : ''
  const from = (resolved.from ?? '').trim()
  const to = (resolved.to ?? '').trim()
  const sort = resolved.sort === 'oldest' ? 'oldest' : 'newest'
  const status = (resolved.status ?? 'SUBMITTED').trim() as ApprovalStatus
  const mine = resolved.mine === '1'
  const hasComment = (resolved.hasComment ?? '').trim()

  const heading =
    status === 'SUBMITTED'
      ? isAdmin
        ? '承認待ち（全件）'
        : `承認待ち（${profile.department}）`
      : `承認一覧（${status}）`

  let query = supabase
    .from('requests')
    .select(
      'id, title, status, department, created_at, amount, needed_by, approver_id, request_types(name), request_actions(comment)'
    )

  if (status) {
    query = query.eq('status', status)
  }

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  if (isAdmin && department) {
    query = query.eq('department', department)
  }

  if (from) {
    query = query.gte('created_at', toDateStart(from))
  }

  if (to) {
    query = query.lt('created_at', toNextDateStart(to))
  }

  if (mine) {
    query = query.eq('approver_id', profile.id)
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

  const filteredRows =
    hasComment === 'yes'
      ? (rows ?? []).filter((r) => hasAnyComment(r))
      : hasComment === 'no'
        ? (rows ?? []).filter((r) => !hasAnyComment(r))
        : (rows ?? [])

  const summary = {
    total: filteredRows.length,
    submitted: countByStatus(filteredRows, 'SUBMITTED'),
    returned: countByStatus(filteredRows, 'RETURNED'),
    approved: countByStatus(filteredRows, 'APPROVED'),
    rejected: countByStatus(filteredRows, 'REJECTED'),
    cancelled: countByStatus(filteredRows, 'CANCELLED'),
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{heading}</h1>
        <Link href="/dashboard" className="underline text-sm">
          ダッシュボードへ
        </Link>
      </div>

      <form className="card grid grid-cols-1 sm:grid-cols-6 gap-3">
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

        <div>
          <label htmlFor="approvals-from" className="label">
            開始日
          </label>
          <input id="approvals-from" name="from" type="date" className="input" defaultValue={from} />
        </div>

        <div>
          <label htmlFor="approvals-to" className="label">
            終了日
          </label>
          <input id="approvals-to" name="to" type="date" className="input" defaultValue={to} />
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

        <div>
          <label htmlFor="approvals-hasComment" className="label">
            コメント有無
          </label>
          <select
            id="approvals-hasComment"
            name="hasComment"
            className="input"
            defaultValue={hasComment}
          >
            <option value="">すべて</option>
            <option value="yes">コメントあり</option>
            <option value="no">コメントなし</option>
          </select>
        </div>

        <div className="sm:col-span-5">
          <label htmlFor="approvals-mine" className="inline-flex items-center gap-2 text-sm pt-8">
            <input
              id="approvals-mine"
              name="mine"
              type="checkbox"
              value="1"
              defaultChecked={mine}
            />
            自分が処理した案件のみ
          </label>
        </div>

        <div className="sm:col-span-6 flex gap-2">
          <button type="submit" className="btn btn-primary">
            絞り込む
          </button>
          <Link href="/approvals" className="btn btn-secondary">
            リセット
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">表示件数</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">SUBMITTED</div>
          <div className="text-2xl font-bold">{summary.submitted}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">RETURNED</div>
          <div className="text-2xl font-bold">{summary.returned}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">APPROVED</div>
          <div className="text-2xl font-bold">{summary.approved}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">REJECTED</div>
          <div className="text-2xl font-bold">{summary.rejected}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">CANCELLED</div>
          <div className="text-2xl font-bold">{summary.cancelled}</div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        {mine ? '自分が処理した案件のみ表示中 / ' : ''}
        {hasComment === 'yes' ? 'コメントありのみ表示中 / ' : ''}
        {hasComment === 'no' ? 'コメントなしのみ表示中 / ' : ''}
        現在の絞り込み結果に対する件数を表示しています。
      </div>

      <div className="space-y-2">
        {filteredRows.map((r) => (
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
                  <span className="chip">コメント: {hasAnyComment(r) ? 'あり' : 'なし'}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 min-w-[160px] text-right">
                {new Date(r.created_at).toLocaleString('ja-JP')}
              </div>
            </div>
          </Link>
        ))}

        {filteredRows.length === 0 && (
          <div className="text-sm text-gray-600">条件に一致する申請はありません。</div>
        )}
      </div>
    </div>
  )
}