// app/requests/new/request-form.tsx

'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/ToastProvider'
import { createDraftRequest } from './actions'

type RequestType = { id: number; name: string }

export function NewRequestForm({ types }: { types: RequestType[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const defaultTypeId = useMemo(() => (types[0]?.id ?? 1), [types])

  const [typeId, setTypeId] = useState<number>(defaultTypeId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [neededBy, setNeededBy] = useState('')

  const canSubmit = title.trim().length > 0 && description.trim().length > 0

  const onCreate = () => {
    if (!canSubmit) {
      toast({ message: 'タイトルと内容は必須です' })
      return
    }

    startTransition(async () => {
      try {
        const result = await createDraftRequest({
          typeId,
          title,
          description,
          amount,
          neededBy,
        })

        router.push(`/requests/${result.id}`)
      } catch (e: any) {
        toast({ message: `作成エラー: ${e?.message ?? e}` })
      }
    })
  }

  return (
    <div className="card space-y-4">
      <div>
        <label htmlFor="new-request-type" className="label">
          申請種別
        </label>
        <select
          id="new-request-type"
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
        <label htmlFor="new-request-title" className="label">
          タイトル（必須）
        </label>
        <input
          id="new-request-title"
          name="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：プリンター用紙 購入申請"
          disabled={pending}
        />
      </div>

      <div>
        <label htmlFor="new-request-description" className="label">
          内容（必須）
        </label>
        <textarea
          id="new-request-description"
          name="description"
          className="input"
          style={{ minHeight: 120 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="背景、必要理由、用途、数量など"
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="new-request-amount" className="label">
            金額（任意）
          </label>
          <input
            id="new-request-amount"
            name="amount"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例：12,000"
            inputMode="numeric"
            disabled={pending}
          />
        </div>

        <div>
          <label htmlFor="new-request-neededBy" className="label">
            希望日（任意）
          </label>
          <input
            id="new-request-neededBy"
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
        <button
          className="btn btn-primary"
          disabled={pending || !canSubmit}
          onClick={onCreate}
        >
          {pending ? '作成中...' : '下書きを作成'}
        </button>

        <Link className="btn btn-secondary" href="/requests">
          キャンセル
        </Link>
      </div>
    </div>
  )
}