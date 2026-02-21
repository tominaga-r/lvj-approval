//app/requests/[id]/RequestActionsPanel.tsx

'use client'

import { useMemo, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog'
import { useToast } from '@/app/components/ui/ToastProvider'
import { approveRequest, cancelRequest, rejectRequest, submitRequest } from './actions'

type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'
type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export function RequestActionsPanel(props: {
  requestId: string
  status: Status
  isOwner: boolean
  myRole: Role
}) {
  const { requestId, status, isOwner, myRole } = props
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [comment, setComment] = useState('')

  const [dialog, setDialog] = useState<null | {
    title: string
    description?: string
    destructive?: boolean
    run: () => Promise<void>
  }>(null)

  const canSubmit = isOwner && status === 'DRAFT'
  const canCancel = isOwner && (status === 'DRAFT' || status === 'SUBMITTED')
  const canDecide = (myRole === 'APPROVER' || myRole === 'ADMIN') && status === 'SUBMITTED'

  const hint = useMemo(() => {
    if (status === 'DRAFT') return '下書き：申請者は編集・提出ができます。'
    if (status === 'SUBMITTED') return '提出済み：承認者が承認/却下できます。'
    return 'この申請は確定しています。'
  }, [status])

  const runWithToast = (fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await fn()
        setComment('')
        toast({ message: '操作が完了しました' })
      } catch (e: any) {
        toast({ message: `エラー: ${e?.message ?? e}` })
      } finally {
        setDialog(null)
      }
    })
  }

  return (
    <div className="card space-y-3">
      <div className="text-sm text-gray-600">{hint}</div>

      <div>
        <label className="label">コメント（任意）</label>
        <input
          className="input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="承認理由/却下理由/補足など"
          disabled={pending}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {canSubmit && (
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              setDialog({
                title: '提出しますか？',
                description: '提出後は承認待ちになります。',
                run: () => submitRequest(requestId, comment),
              })
            }
          >
            {pending ? '処理中...' : '提出'}
          </button>
        )}

        {canCancel && (
          <button
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              setDialog({
                title: '取消しますか？',
                description: '取消後はキャンセル扱いになります。',
                destructive: true,
                run: () => cancelRequest(requestId, comment),
              })
            }
          >
            {pending ? '処理中...' : '取消'}
          </button>
        )}

        {canDecide && (
          <>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                setDialog({
                  title: '承認しますか？',
                  description: '承認すると APPROVED状態 になります。',
                  run: () => approveRequest(requestId, comment),
                })
              }
            >
              {pending ? '処理中...' : '承認'}
            </button>

            <button
              className="btn btn-secondary"
              disabled={pending}
              onClick={() =>
                setDialog({
                  title: '却下しますか？',
                  description: '却下すると REJECTED状態 になります。',
                  destructive: true,
                  run: () => rejectRequest(requestId, comment),
                })
              }
            >
              {pending ? '処理中...' : '却下'}
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        destructive={dialog?.destructive}
        confirmLabel={pending ? '処理中...' : '実行'}
        cancelLabel="キャンセル"
        onClose={() => !pending && setDialog(null)}
                onConfirm={() => {
          if (!dialog) return
          runWithToast(dialog.run)
        }}
      />
    </div>
  )
}