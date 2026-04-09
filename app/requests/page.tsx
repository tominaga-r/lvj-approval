// app/requests/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/authz'
import { canCreateRequest } from '@/lib/permissions'
import { formatAmount } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    q?: string
    status?: string
    typeId?: string
    sort?: string
  }>
}

type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

function statusChipClass(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'SUBMITTED':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'APPROVED':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'REJECTED':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'CANCELLED':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function getTypeName(row: {
  request_types?: { name?: string } | { name?: string }[] | null
}) {
  if (Array.isArray(row.request_types)) {
    return row.request_types[0]?.name ?? '-'
  }
  return row.request_types?.name ?? '-'
}

export default async function RequestsPage({ searchParams }: Props) {
  const { supabase, profile } = await requireProfile()
  const canCreate = canCreateRequest(profile.role)
  const resolved = await searchParams

  const q = (resolved.q ?? '').trim()
  const status = (resolved.status ?? '').trim()
  const typeId = (resolved.typeId ?? '').trim()
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

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  if (status) {
    query = query.eq('status', status as Status)
  }

  if (typeId) {
    const parsedTypeId = Number(typeId)
    if (!Number.isNaN(parsedTypeId)) {
      query = query.eq('type_id', parsedTypeId)
    }
  }

  query = query.order('created_at', { ascending: sort === 'oldest' })

  const { data: rows, error } = await query

  if (error) {
    return <div className="p-6 text-red-600">requests取得エラー: {error.message}</div>
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

      <form className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
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
          <label htmlFor="requests-sort" className="label">
            並び順
          </label>
          <select id="requests-sort" name="sort" className="input" defaultValue={sort}>
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
          <button type="submit" className="btn btn-primary">
            絞り込む
          </button>
          <Link href="/requests" className="btn btn-secondary">
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
                <div className="flex gap-2 flex-wrap text-xs">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 ${statusChipClass(
                      r.status
                    )}`}
                  >
                    {r.status}
                  </span>
                  <span className="chip">種別: {getTypeName(r)}</span>
                  <span className="chip">金額: {formatAmount(r.amount)}</span>
                  <span className="chip">希望日: {r.needed_by ?? '-'}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1 text-right min-w-[180px]">
                <div>作成: {new Date(r.created_at).toLocaleString('ja-JP')}</div>
                <div>更新: {new Date(r.updated_at).toLocaleString('ja-JP')}</div>
              </div>
            </div>
          </Link>
        ))}

        {(rows ?? []).length === 0 && (
          <div className="text-sm text-gray-600">条件に一致する申請がありません。</div>
        )}
      </div>
    </div>
  )
}