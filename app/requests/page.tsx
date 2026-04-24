// app/requests/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/authz'
import { canCreateRequest } from '@/lib/permissions'
import { formatAmount } from '@/lib/format'
import { getStatusChipClass } from '@/lib/status'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    q?: string
    status?: string
    typeId?: string
    sort?: string
    from?: string
    to?: string
  }>
}

type Status =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

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

function countByStatus<T extends { status: string }>(rows: T[], status: string) {
  return rows.filter((r) => r.status === status).length
}

export default async function RequestsPage({ searchParams }: Props) {
  const { supabase, profile } = await requireProfile()
  const canCreate = canCreateRequest(profile.role)
  const resolved = await searchParams

  const q = (resolved.q ?? '').trim()
  const status = (resolved.status ?? '').trim()
  const typeId = (resolved.typeId ?? '').trim()
  const from = (resolved.from ?? '').trim()
  const to = (resolved.to ?? '').trim()
  const sort = resolved.sort === 'oldest' ? 'oldest' : 'newest'

  const { data: types } = await supabase
    .from('request_types')
    .select('id, name')
    .order('id', { ascending: true })

  let query = supabase
    .from('requests')
    .select(
      'id, title, status, created_at, updated_at, amount, needed_by, type_id, request_types(name)'
    )

  if (q) query = query.ilike('title', `%${q}%`)
  if (status) query = query.eq('status', status as Status)

  if (typeId) {
    const parsedTypeId = Number(typeId)
    if (!Number.isNaN(parsedTypeId)) {
      query = query.eq('type_id', parsedTypeId)
    }
  }

  if (from) query = query.gte('created_at', toDateStart(from))
  if (to) query = query.lt('created_at', toNextDateStart(to))

  query = query.order('created_at', { ascending: sort === 'oldest' })

  const { data: rows, error } = await query

  if (error) {
    return <div className="p-6 text-red-600">requests取得エラー: {error.message}</div>
  }

  const list = rows ?? []
  const summary = {
    total: list.length,
    draft: countByStatus(list, 'DRAFT'),
    submitted: countByStatus(list, 'SUBMITTED'),
    returned: countByStatus(list, 'RETURNED'),
    approved: countByStatus(list, 'APPROVED'),
    rejected: countByStatus(list, 'REJECTED'),
    cancelled: countByStatus(list, 'CANCELLED'),
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">申請一覧</h1>
        {canCreate && (
          <Link className="btn btn-secondary w-full sm:w-auto justify-center" href="/requests/new">
            新規申請
          </Link>
        )}
      </div>

      <div className="text-sm text-gray-600">
        あなたの部署: {profile.department} / ロール: {profile.role}
      </div>

      <form className="card grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="xl:col-span-2">
          <label htmlFor="requests-q" className="label">
            キーワード
          </label>
          <input
            id="requests-q"
            name="q"
            className="input"
            defaultValue={q}
            placeholder="タイトルで検索"
          />
        </div>

        <div>
          <label htmlFor="requests-status" className="label">
            ステータス
          </label>
          <select id="requests-status" name="status" className="input" defaultValue={status}>
            <option value="">すべて</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="RETURNED">RETURNED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div>
          <label htmlFor="requests-typeId" className="label">
            申請種別
          </label>
          <select id="requests-typeId" name="typeId" className="input" defaultValue={typeId}>
            <option value="">すべて</option>
            {(types ?? []).map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="requests-from" className="label">
            開始日
          </label>
          <input id="requests-from" name="from" type="date" className="input" defaultValue={from} />
        </div>

        <div>
          <label htmlFor="requests-to" className="label">
            終了日
          </label>
          <input id="requests-to" name="to" type="date" className="input" defaultValue={to} />
        </div>

        <div>
          <label htmlFor="requests-sort" className="label">
            並び順
          </label>
          <select id="requests-sort" name="sort" className="input" defaultValue={sort}>
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </div>

        <div className="sm:col-span-2 xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="submit" className="btn btn-primary justify-center">
            絞り込む
          </button>
          <Link href="/requests" className="btn btn-secondary justify-center">
            リセット
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">表示件数</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="card space-y-1">
          <div className="text-xs text-gray-500">DRAFT</div>
          <div className="text-2xl font-bold">{summary.draft}</div>
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

      <div className="space-y-3">
        {list.map((r) => (
          <Link key={r.id} href={`/requests/${r.id}`} className="block card hover:bg-gray-50">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex gap-2 flex-wrap items-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusChipClass(
                          r.status
                        )}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="text-base sm:text-lg font-semibold break-words">
                      {r.title}
                    </div>
                  </div>

                  <div className="sm:text-right min-w-0 sm:min-w-[140px]">
                    <div className="text-xs text-gray-500">金額</div>
                    <div className="text-lg font-semibold break-words">
                      {formatAmount(r.amount)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="chip break-words">種別: {getTypeName(r)}</div>
                <div className="chip break-words">希望日: {r.needed_by ?? '-'}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-500">
                <div>作成: {new Date(r.created_at).toLocaleString('ja-JP')}</div>
                <div className="sm:text-right">
                  更新: {new Date(r.updated_at).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
          </Link>
        ))}

        {list.length === 0 && (
          <div className="text-sm text-gray-600">条件に一致する申請がありません。</div>
        )}
      </div>
    </div>
  )
}