// app/requests/[id]/RequestActionsPanel.tsx

'use client'

import { useMemo, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog'
import { useToast } from '@/app/components/ui/ToastProvider'
import { normalizeErrorMessage } from '@/lib/error'
import {
  approveRequest,
  cancelRequest,
  rejectRequest,
  returnRequest,
  submitRequest,
} from './actions'
import {
  canCancel,
  canDecide,
  canReturn,
  canSubmit,
  type Role,
  type Status,
} from '@/lib/permissions'

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

  const canSubmitAction = canSubmit(isOwner, status)
  const canCancelAction = canCancel(isOwner, status)
  const canDecideAction = canDecide(myRole, status)
  const canReturnAction = canReturn(myRole, status)

  const hint = useMemo(() => {
    if (status === 'DRAFT') return '下書き：申請者は編集・提出ができます。'
    if (status === 'RETURNED') return '差し戻し：修正後に再提出できます。'
    if (status === 'SUBMITTED') return '提出済み：承認者が承認・差し戻し・却下できます。'
    return 'この申請は確定しています。'
  }, [status])

  const runWithToast = (fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await fn()
        setComment('')
        toast({ message: '操作が完了しました' })
      } catch (e: unknown) {
        toast({ message: `エラー: ${normalizeErrorMessage(e)}` })
      } finally {
        setDialog(null)
      }
    })
  }

  return (
    <div className="card space-y-3">
      <div className="text-sm text-gray-600">{hint}</div>

      <div>
        <label htmlFor="request-action-comment" className="label">
          コメント（任意）
        </label>
        <input
          id="request-action-comment"
          name="comment"
          className="input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="承認理由/差し戻し理由/却下理由/補足など"
          disabled={pending}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {canSubmitAction && (
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              setDialog({
                title: status === 'RETURNED' ? '再提出しますか？' : '提出しますか？',
                description:
                  status === 'RETURNED'
                    ? '修正済みの申請を再提出して承認待ちに戻します。'
                    : '提出後は承認待ちになります。',
                run: () => submitRequest(requestId, comment),
              })
            }
          >
            {pending ? '処理中...' : status === 'RETURNED' ? '再提出' : '提出'}
          </button>
        )}

        {canCancelAction && (
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

        {canReturnAction && (
          <button
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              setDialog({
                title: '差し戻しますか？',
                description: '差し戻すと申請者が修正・再提出できる状態になります。',
                run: () => returnRequest(requestId, comment),
              })
            }
          >
            {pending ? '処理中...' : '差し戻し'}
          </button>
        )}

        {canDecideAction && (
          <>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                setDialog({
                  title: '承認しますか？',
                  description: '承認すると APPROVED になります。',
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
                  description: '却下すると REJECTED になります。',
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