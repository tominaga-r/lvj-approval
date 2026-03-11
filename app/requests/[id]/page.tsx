// app/requests/[id]/page.tsx

import Link from 'next/link'
import { requireProfile } from '@/lib/authz'
import { RequestActionsPanel } from './RequestActionsPanel'
import EditDraftForm from './EditDraftForm'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function RequestDetailPage({ params }: Props) {
  const { id: requestId } = await params
  const { supabase, profile: me } = await requireProfile()


  // 申請（RLSで範囲が制限される）
  const { data: reqRow, error: reqErr } = await supabase
    .from('requests')
    .select(
      'id, title, description, amount, needed_by, status, requester_id, approver_id, department, type_id, created_at, updated_at'
    )
    .eq('id', requestId)
    .single()

  if (reqErr || !reqRow) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-3">
        <div className="text-red-600">
          申請が見つからない/権限がありません: {reqErr?.message ?? 'unknown'}
        </div>
        <Link className="underline" href="/requests">
          申請一覧へ戻る
        </Link>
      </div>
    )
  }

  const { data: typeRow } = await supabase
    .from('request_types')
    .select('name')
    .eq('id', reqRow.type_id)
    .single()

  // 申請者名（承認者は同部署profilesをSELECT可、というDB設計）
  const { data: requesterProfile } = await supabase
    .from('profiles')
    .select('name, department')
    .eq('id', reqRow.requester_id)
    .single()

  const { data: actions } = await supabase
    .from('request_actions')
    .select('id, action, comment, actor_id, created_at')
    .eq('request_id', reqRow.id)
    .order('created_at', { ascending: false })

  const canEditDraft =
    reqRow.status === 'DRAFT' && (me.role === 'ADMIN' || me.id === reqRow.requester_id)

  // 編集できるときだけ request_types を取得
  let typesForEdit: { id: number; name: string }[] = []
  if (canEditDraft) {
    const { data } = await supabase
      .from('request_types')
      .select('id, name')
      .order('id', { ascending: true })
    typesForEdit = data ?? []
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">申請詳細</h1>
        <Link href="/requests" className="underline text-sm">
          一覧へ戻る
        </Link>
      </div>

      <div className="card space-y-2">
        <div className="text-sm text-gray-600">
          種別:{' '}
          <span className="text-gray-900">
            {typeRow?.name ?? `type_id=${reqRow.type_id}`}
          </span>
        </div>

        <div className="text-sm text-gray-600">
          申請者:{' '}
          <span className="text-gray-900">
            {requesterProfile?.name ?? reqRow.requester_id}
          </span>
          {requesterProfile?.department ? ` / ${requesterProfile.department}` : ''}
        </div>

        <div className="text-sm text-gray-600">
          部署: <span className="text-gray-900">{reqRow.department}</span>
        </div>

        <div className="text-sm text-gray-600">
          ステータス:{' '}
          <span className="text-gray-900 font-semibold">{reqRow.status}</span>
        </div>

        <div className="pt-2">
          <div className="font-semibold">{reqRow.title}</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
            {reqRow.description}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm pt-2">
          <div className="rounded border p-2 bg-white">金額: {reqRow.amount ?? '-'}</div>
          <div className="rounded border p-2 bg-white">希望日: {reqRow.needed_by ?? '-'}</div>
          <div className="rounded border p-2 bg-white">
            更新: {new Date(reqRow.updated_at).toLocaleString()}
          </div>
        </div>
      </div>

      {canEditDraft && (
        <EditDraftForm
          requestId={reqRow.id}
          types={typesForEdit}
          initial={{
            type_id: reqRow.type_id,
            title: reqRow.title ?? '',
            description: reqRow.description ?? '',
            amount: reqRow.amount != null ? String(reqRow.amount) : '',
            needed_by: reqRow.needed_by ? String(reqRow.needed_by) : '',
          }}
        />
      )}

      <RequestActionsPanel
        requestId={reqRow.id}
        status={reqRow.status}
        isOwner={me.id === reqRow.requester_id}
        myRole={me.role}
      />

      <div className="card">
        <div className="font-semibold mb-2">履歴</div>

        <div className="space-y-2 text-sm">
          {(actions ?? []).length === 0 && (
            <div className="text-gray-500">履歴はまだありません</div>
          )}

          {(actions ?? []).map((a) => (
            <div key={a.id} className="rounded border p-2 bg-white">
              <div className="text-gray-700">
                <span className="font-semibold">{a.action}</span>
                <span className="text-gray-500">
                  {' '}
                  / {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              {a.comment && (
                <div className="mt-1 text-gray-800 whitespace-pre-wrap">{a.comment}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}