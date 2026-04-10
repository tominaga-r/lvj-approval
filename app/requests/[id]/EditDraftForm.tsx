// app/requests/[id]/EditDraftForm.tsx
'use client'
import { useMemo, useState, useTransition } from 'react'
import { useToast } from '@/app/components/ui/ToastProvider'
import { normalizeErrorMessage } from '@/lib/error'
import { updateDraftRequest } from './actions'

type RequestType = { id: number; name: string }

export default function EditDraftForm(props: {
  requestId: string
  types: RequestType[]
  initial: {
    type_id: number
    title: string
    description: string
    amount: string
    needed_by: string
  }
}) {
  const { requestId, types, initial } = props
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const defaultTypeId = useMemo(
    () => initial.type_id ?? (types[0]?.id ?? 1),
    [initial.type_id, types]
  )

  const [typeId, setTypeId] = useState<number>(defaultTypeId)
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [amount, setAmount] = useState(initial.amount ?? '')
  const [neededBy, setNeededBy] = useState(initial.needed_by ?? '')

  const canSave = title.trim().length > 0 && description.trim().length > 0

  const onSave = () => {
    if (!canSave) {
      toast({ message: 'タイトルと内容は必須です' })
      return
    }

    startTransition(async () => {
      try {
        await updateDraftRequest(requestId, {
          typeId,
          title,
          description,
          amount,
          neededBy,
        })
        toast({ message: '下書きを更新しました' })
      } catch (e: unknown) {
        toast({ message: `更新エラー: ${normalizeErrorMessage(e)}` })
      }
    })
  }

  return (
    <div className="card space-y-4">
      <div className="font-medium">申請の編集（DRAFT / RETURNED）</div>

      <div>
        <label htmlFor="edit-draft-type" className="label">
          申請種別
        </label>
        <select
          id="edit-draft-type"
          name="typeId"
          className="input"
          value={typeId}
          onChange={(e) => setTypeId(Number(e.target.value))}
          disabled={pending}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-draft-title" className="label">
          タイトル（必須）
        </label>
        <input
          id="edit-draft-title"
          name="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
        />
      </div>

      <div>
        <label htmlFor="edit-draft-description" className="label">
          内容（必須）
        </label>
        <textarea
          id="edit-draft-description"
          name="description"
          className="input"
          style={{ minHeight: 120 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-draft-amount" className="label">
            金額（任意）
          </label>
          <input
            id="edit-draft-amount"
            name="amount"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="例：12,000"
            disabled={pending}
          />
        </div>
        <div>
          <label htmlFor="edit-draft-neededBy" className="label">
            希望日（任意）
          </label>
          <input
            id="edit-draft-neededBy"
            name="neededBy"
            className="input"
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending || !canSave} onClick={onSave}>
          {pending ? '更新中...' : '保存'}
        </button>
      </div>
    </div>
  )
}