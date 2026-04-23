// app/requests/[id]/page.tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/authz'
import { RequestActionsPanel } from './RequestActionsPanel'
import EditDraftForm from './EditDraftForm'
import { formatAmount } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

function actionLabel(action: string) {
  switch (action) {
    case 'CREATE':
      return '作成'
    case 'UPDATE':
      return '更新'
    case 'SUBMIT':
      return '提出'
    case 'RETURN':
      return '差し戻し'
    case 'APPROVE':
      return '承認'
    case 'REJECT':
      return '却下'
    case 'CANCEL':
      return '取消'
    default:
      return action
  }
}

export default async function RequestDetailPage({ params }: Props) {
  const { id: requestId } = await params
  const { supabase, profile: me } = await requireProfile()

  const { data: reqRow, error: reqErr } = await supabase
    .from('requests')
    .select(
      'id, title, description, amount, needed_by, status, requester_id, approver_id, department, type_id, created_at, updated_at'
    )
    .eq('id', requestId)
    .single()

  if (reqErr || !reqRow) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-red-600 mb-4">
          申請が見つからない/権限がありません: {reqErr?.message ?? 'unknown'}
        </div>
        <Link href="/requests" className="underline">
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

  const actorIds = Array.from(
    new Set((actions ?? []).map((a) => a.actor_id).filter((v): v is string => typeof v === 'string' && v.length > 0))
  )

  let actorNameMap: Record<string, { name: string; role: string; department: string }> = {}

  if (actorIds.length > 0) {
    const { data: actorProfiles } = await supabase
      .from('profiles')
      .select('id, name, role, department')
      .in('id', actorIds)

    actorNameMap = Object.fromEntries(
      (actorProfiles ?? []).map((p) => [
        p.id,
        {
          name: p.name,
          role: p.role,
          department: p.department,
        },
      ])
    )
  }

  const canEditDraft =
    (reqRow.status === 'DRAFT' || reqRow.status === 'RETURNED') &&
    me.id === reqRow.requester_id

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
      <h1 className="text-xl font-bold">申請詳細</h1>

      <div className="text-sm">
        <Link href="/requests" className="underline">
          一覧へ戻る
        </Link>
      </div>

      <div className="card space-y-2">
        <div>種別: {typeRow?.name ?? `type_id=${reqRow.type_id}`}</div>
        <div>
          申請者: {requesterProfile?.name ?? reqRow.requester_id}
          {requesterProfile?.department ? ` / ${requesterProfile.department}` : ''}
        </div>
        <div>部署: {reqRow.department}</div>
        <div>ステータス: {reqRow.status}</div>
        <div className="font-semibold">{reqRow.title}</div>
        <div className="whitespace-pre-wrap">{reqRow.description}</div>
        <div>金額: {formatAmount(reqRow.amount)}</div>
        <div>希望日: {reqRow.needed_by ?? '-'}</div>
        <div>更新: {new Date(reqRow.updated_at).toLocaleString('ja-JP')}</div>
      </div>

      {canEditDraft && (
      <EditDraftForm
        requestId={reqRow.id}
        initial={{
          type_id: reqRow.type_id,
          title: reqRow.title,
          description: reqRow.description,
          amount: reqRow.amount != null ? String(reqRow.amount) : '',
          needed_by: reqRow.needed_by ?? '',
        }}
        types={typesForEdit}
      />
      )}

      <RequestActionsPanel
        requestId={reqRow.id}
        status={reqRow.status}
        isOwner={me.id === reqRow.requester_id}
        myRole={me.role}
      />

      <div className="card space-y-3">
        <h2 className="font-semibold">履歴</h2>

        {(actions ?? []).length === 0 && (
          <div className="text-sm text-gray-600">履歴はまだありません</div>
        )}

        {(actions ?? []).map((a) => {
          const actor = actorNameMap[a.actor_id]
          const actorText = actor
            ? `${actor.name} (${actor.role} / ${actor.department})`
            : a.actor_id

          return (
            <div key={a.id} className="rounded border p-3 bg-white space-y-1">
              <div className="text-sm font-medium">
                {actionLabel(a.action)} / {new Date(a.created_at).toLocaleString('ja-JP')}
              </div>
              <div className="text-xs text-gray-600">実行者: {actorText}</div>
              {a.comment && (
                <div className="text-sm whitespace-pre-wrap rounded bg-gray-50 p-2">
                  {a.comment}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}