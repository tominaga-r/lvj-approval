// app/admin/AdminClient.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog'
import { useToast } from '@/app/components/ui/ToastProvider'
import {
  createRequestType,
  deleteRequestType,
  renameRequestType,
  updateUserRoleDepartment,
} from './actions'

type RequestTypeRow = { id: number; name: string; created_at: string }
type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'
type UserRow = {
  id: string
  name: string
  role: Role
  department: string
  created_at: string
  updated_at: string
}

export default function AdminClient(props: { requestTypes: RequestTypeRow[]; users: UserRow[] }) {
  const { requestTypes, users } = props
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // request_types
  const [newTypeName, setNewTypeName] = useState('')
  const [rename, setRename] = useState<Record<number, string>>({})
  const [dialog, setDialog] = useState<null | {
    title: string
    description?: string
    destructive?: boolean
    run: () => Promise<void>
  }>(null)

  // users
  const [editUser, setEditUser] = useState<Record<string, { role: Role; department: string }>>({})

  const usersWithDraft = useMemo(() => {
    const map = { ...editUser }
    users.forEach((u) => {
      if (!map[u.id]) map[u.id] = { role: u.role, department: u.department }
    })
    return map
  }, [users, editUser])

  const run = (fn: () => Promise<void>) => {
  startTransition(async () => {
    try {
      await fn()
      toast({ message: '更新しました' })
      router.refresh() // ★これでadmin一覧が即時反映される
    } catch (e: any) {
      toast({ message: `エラー: ${e?.message ?? e}` })
    } finally {
      setDialog(null)
    }
  })
}

  return (
    <div className="space-y-8">
      {/* request_types */}
      <div className="card space-y-4">
        <div className="font-semibold">申請種別マスタ（request_types）</div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="input"
            placeholder="新しい種別名（例：店舗備品購入申請）"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            disabled={pending}
          />
          <button
            className="btn btn-primary"
            disabled={pending || newTypeName.trim().length === 0}
            onClick={() =>
              run(async () => {
                await createRequestType(newTypeName)
                setNewTypeName('')
              })
            }
          >
            追加
          </button>
        </div>

        <div className="space-y-2">
          {requestTypes.map((t) => {
            const v = rename[t.id] ?? t.name
            return (
              <div key={t.id} className="rounded border p-3 bg-white space-y-2">
                <div className="text-xs text-gray-500">id: {t.id}</div>

                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    className="input"
                    value={v}
                    onChange={(e) => setRename((p) => ({ ...p, [t.id]: e.target.value }))}
                    disabled={pending}
                  />
                  <button
                    className="btn btn-secondary"
                    disabled={pending || v.trim().length === 0 || v.trim() === t.name}
                    onClick={() =>
                      run(async () => {
                        await renameRequestType(t.id, v)
                      })
                    }
                  >
                    名前変更
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={pending}
                    onClick={() =>
                      setDialog({
                        title: 'この種別を削除しますか？',
                        description:
                          '既に申請で使用されている種別は削除できない場合があります。',
                        destructive: true,
                        run: () => deleteRequestType(t.id),
                      })
                    }
                  >
                    削除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* users */}
      <div className="card space-y-4">
        <div className="font-semibold">ユーザー権限・部署（profiles）</div>
        <div className="text-xs text-gray-600">
          ※ role/department は ADMIN のみ変更できます（DBトリガー/ポリシー）。
        </div>

        <div className="space-y-2">
          {users.map((u) => {
            const draft = usersWithDraft[u.id]
            const changed = draft.role !== u.role || draft.department !== u.department

            return (
              <div key={u.id} className="rounded border p-3 bg-white space-y-2">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-gray-500 break-all">id: {u.id}</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="label">Role</label>
                    <select
                      className="input"
                      value={draft.role}
                      onChange={(e) =>
                        setEditUser((p) => ({
                          ...p,
                          [u.id]: { ...draft, role: e.target.value as Role },
                        }))
                      }
                      disabled={pending}
                    >
                      <option value="REQUESTER">REQUESTER</option>
                      <option value="APPROVER">APPROVER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Department</label>
                    <input
                      className="input"
                      value={draft.department}
                      onChange={(e) =>
                        setEditUser((p) => ({
                          ...p,
                          [u.id]: { ...draft, department: e.target.value },
                        }))
                      }
                      disabled={pending}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary"
                      disabled={pending || !changed}
                      onClick={() =>
                        run(async () => {
                          await updateUserRoleDepartment(u.id, draft.role, draft.department)
                        })
                      }
                    >
                      反映
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  現在: {u.role} / {u.department}
                </div>
              </div>
            )
          })}
        </div>
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
          run(dialog.run)
        }}
      />
    </div>
  )
}