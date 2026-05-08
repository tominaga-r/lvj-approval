// app/admin/AdminClient.tsx
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog'
import { useToast } from '@/app/components/ui/ToastProvider'
import { normalizeErrorMessage } from '@/lib/error'
import {
  createRequestType,
  deleteRequestType,
  inviteUser,
  renameRequestType,
  updateUserActive,
  updateUserRoleDepartment,
} from './actions'

type RequestTypeRow = { id: number; name: string; created_at: string }
type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'
type UserRow = {
  id: string
  name: string
  role: Role
  department: string
  is_active: boolean
  created_at: string
  updated_at: string
}
type RequestTypeSort = 'id-asc' | 'name-asc' | 'name-desc'

type AdminAuditLogRow = {
  id: number
  actor_id: string
  action: string
  target_user_id: string | null
  entity_type: string
  entity_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

type ProfileMap = Record<
  string,
  {
    name: string
    role: Role
    department: string
  }
>

function normalizeTypeName(value: string) {
  return value.trim().toLowerCase()
}

function actionLabel(action: string) {
  switch (action) {
    case 'INVITE_USER':
      return 'ユーザー招待'
    case 'UPDATE_USER_ROLE':
      return '権限変更'
    case 'UPDATE_USER_DEPARTMENT':
      return '部署変更'
    case 'UPDATE_USER_ACTIVE':
      return 'ユーザー有効状態変更'
    case 'CREATE_REQUEST_TYPE':
      return '申請種別追加'
    case 'RENAME_REQUEST_TYPE':
      return '申請種別名変更'
    case 'DELETE_REQUEST_TYPE':
      return '申請種別削除'
    default:
      return action
  }
}

function summarizeData(data: Record<string, unknown> | null | undefined) {
  if (!data) return '—'

  const entries = Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && String(value) !== '')
    .slice(0, 4)

  if (entries.length === 0) return '—'

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' / ')
}

function targetLabel(log: AdminAuditLogRow, profileMap: ProfileMap) {
  if (log.target_user_id) {
    const p = profileMap[log.target_user_id]
    return p ? `${p.name} (${p.role} / ${p.department})` : log.target_user_id
  }

  if (log.entity_type === 'request_types' && log.entity_id) {
    const afterName =
      typeof log.after_data?.name === 'string' ? log.after_data.name : null
    const beforeName =
      typeof log.before_data?.name === 'string' ? log.before_data.name : null
    return afterName ?? beforeName ?? `request_type:${log.entity_id}`
  }

  return log.entity_id ?? log.entity_type
}

export default function AdminClient(props: {
  requestTypes: RequestTypeRow[]
  users: UserRow[]
  auditLogs: AdminAuditLogRow[]
  profileMap: ProfileMap
  currentUserId: string
}) {
  const { requestTypes, users, auditLogs, profileMap, currentUserId } = props
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('REQUESTER')
  const [inviteDepartment, setInviteDepartment] = useState('')

  const [newTypeName, setNewTypeName] = useState('')
  const [rename, setRename] = useState<Record<number, string>>({})
  const [dialog, setDialog] = useState<null | {
    title: string
    description?: string
    destructive?: boolean
    run: () => Promise<void>
  }>(null)

  const [editUser, setEditUser] = useState<Record<string, { role: Role; department: string }>>({})
  const [nameQuery, setNameQuery] = useState('')
  const [departmentQuery, setDepartmentQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')

  const [requestTypeQuery, setRequestTypeQuery] = useState('')
  const [requestTypeSort, setRequestTypeSort] = useState<RequestTypeSort>('id-asc')

  const usersWithDraft = useMemo(() => {
    const map = { ...editUser }
    users.forEach((u) => {
      if (!map[u.id]) map[u.id] = { role: u.role, department: u.department }
    })
    return map
  }, [users, editUser])

  const filteredUsers = useMemo(() => {
    const nq = nameQuery.trim().toLowerCase()
    const dq = departmentQuery.trim().toLowerCase()

    return users.filter((u) => {
      const matchesName = nq.length === 0 || u.name.toLowerCase().includes(nq)
      const matchesDepartment = dq.length === 0 || u.department.toLowerCase().includes(dq)
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      return matchesName && matchesDepartment && matchesRole
    })
  }, [users, nameQuery, departmentQuery, roleFilter])

  const filteredRequestTypes = useMemo(() => {
    const q = requestTypeQuery.trim().toLowerCase()

    const next = requestTypes.filter((t) => {
      if (!q) return true
      return t.name.toLowerCase().includes(q)
    })

    next.sort((a, b) => {
      if (requestTypeSort === 'name-asc') return a.name.localeCompare(b.name, 'ja')
      if (requestTypeSort === 'name-desc') return b.name.localeCompare(a.name, 'ja')
      return a.id - b.id
    })

    return next
  }, [requestTypes, requestTypeQuery, requestTypeSort])

  const existingTypeNameSet = useMemo(() => {
    return new Set(requestTypes.map((t) => normalizeTypeName(t.name)))
  }, [requestTypes])

  const newTypeNameNormalized = normalizeTypeName(newTypeName)
  const isDuplicateNewType =
    newTypeNameNormalized.length > 0 && existingTypeNameSet.has(newTypeNameNormalized)

  const canInvite =
    inviteEmail.trim().length > 0 &&
    inviteName.trim().length > 0 &&
    inviteDepartment.trim().length > 0

  const run = (fn: () => Promise<void>, successMessage = '更新しました') => {
    startTransition(async () => {
      try {
        await fn()
        toast({ message: successMessage })
        router.refresh()
      } catch (e: unknown) {
        toast({ message: `エラー: ${normalizeErrorMessage(e)}` })
      } finally {
        setDialog(null)
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="card space-y-4">
        <div className="font-semibold">ユーザー招待</div>
        <div className="text-xs text-gray-600">
          招待メールを送信し、同時に role / department を初期設定します。
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="admin-invite-email" className="label">
              メールアドレス
            </label>
            <input
              id="admin-invite-email"
              className="input"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={pending}
            />
          </div>

          <div>
            <label htmlFor="admin-invite-name" className="label">
              氏名
            </label>
            <input
              id="admin-invite-name"
              className="input"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="山田 太郎"
              disabled={pending}
            />
          </div>

          <div>
            <label htmlFor="admin-invite-role" className="label">
              Role
            </label>
            <select
              id="admin-invite-role"
              className="input"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              disabled={pending}
            >
              <option value="REQUESTER">REQUESTER</option>
              <option value="APPROVER">APPROVER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-invite-department" className="label">
              Department
            </label>
            <input
              id="admin-invite-department"
              className="input"
              value={inviteDepartment}
              onChange={(e) => setInviteDepartment(e.target.value)}
              placeholder="SALES"
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            disabled={pending || !canInvite}
            onClick={() =>
              run(
                async () => {
                  await inviteUser({
                    email: inviteEmail,
                    name: inviteName,
                    role: inviteRole,
                    department: inviteDepartment,
                  })
                  setInviteEmail('')
                  setInviteName('')
                  setInviteRole('REQUESTER')
                  setInviteDepartment('')
                },
                '招待メールを送信しました'
              )
            }
          >
            {pending ? '処理中...' : '招待メール送信'}
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="font-semibold">申請種別マスタ（request_types）</div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="admin-new-type-name" className="sr-only">
              新しい種別名
            </label>
            <input
              id="admin-new-type-name"
              name="newTypeName"
              className="input w-full"
              placeholder="新しい種別名（例：店舗備品購入申請）"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              disabled={pending}
            />
            {isDuplicateNewType && (
              <div className="mt-1 text-xs text-red-600">
                同じ名前の申請種別が既にあります。
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={pending || newTypeName.trim().length === 0 || isDuplicateNewType}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="admin-request-type-search" className="label">
              種別名検索
            </label>
            <input
              id="admin-request-type-search"
              name="requestTypeSearch"
              className="input"
              value={requestTypeQuery}
              onChange={(e) => setRequestTypeQuery(e.target.value)}
              placeholder="種別名で検索"
              disabled={pending}
            />
          </div>

          <div>
            <label htmlFor="admin-request-type-sort" className="label">
              並び順
            </label>
            <select
              id="admin-request-type-sort"
              name="requestTypeSort"
              className="input"
              value={requestTypeSort}
              onChange={(e) => setRequestTypeSort(e.target.value as RequestTypeSort)}
              disabled={pending}
            >
              <option value="id-asc">登録順</option>
              <option value="name-asc">名前昇順</option>
              <option value="name-desc">名前降順</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          表示件数: {filteredRequestTypes.length} / {requestTypes.length}
        </div>

        <div className="space-y-2">
          {filteredRequestTypes.map((t) => {
            const v = rename[t.id] ?? t.name
            const renameId = `admin-rename-type-${t.id}`
            const normalizedCurrent = normalizeTypeName(v)
            const isDuplicateRename =
              normalizedCurrent.length > 0 &&
              requestTypes.some(
                (other) =>
                  other.id !== t.id && normalizeTypeName(other.name) === normalizedCurrent
              )

            return (
              <div key={t.id} className="rounded border p-3 bg-white space-y-2">
                <div className="text-xs text-gray-500">id: {t.id}</div>

                <div className="flex gap-2 flex-wrap items-start">
                  <div className="flex-1 min-w-[240px]">
                    <label htmlFor={renameId} className="sr-only">
                      種別名（id: {t.id}）
                    </label>
                    <input
                      id={renameId}
                      name={`renameType-${t.id}`}
                      className="input w-full"
                      value={v}
                      onChange={(e) => setRename((p) => ({ ...p, [t.id]: e.target.value }))}
                      disabled={pending}
                    />
                    {isDuplicateRename && (
                      <div className="mt-1 text-xs text-red-600">
                        同じ名前の申請種別が既にあります。
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-secondary"
                    disabled={
                      pending ||
                      v.trim().length === 0 ||
                      v.trim() === t.name ||
                      isDuplicateRename
                    }
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
                        description: '既に申請で使用されている種別は削除できない場合があります。',
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

          {filteredRequestTypes.length === 0 && (
            <div className="rounded border p-3 bg-white text-sm text-gray-600">
              一致する申請種別はありません。
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="font-semibold">ユーザー権限・部署（profiles）</div>
        <div className="text-xs text-gray-600">
          ※ role / department / 有効状態は ADMIN のみ変更できます。
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label htmlFor="admin-user-search-name" className="label">
              Name検索
            </label>
            <input
              id="admin-user-search-name"
              name="searchName"
              className="input"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="名前で検索"
              disabled={pending}
            />
          </div>

          <div>
            <label htmlFor="admin-user-search-department" className="label">
              Department検索
            </label>
            <input
              id="admin-user-search-department"
              name="searchDepartment"
              className="input"
              value={departmentQuery}
              onChange={(e) => setDepartmentQuery(e.target.value)}
              placeholder="部署で検索"
              disabled={pending}
            />
          </div>

          <div>
            <label htmlFor="admin-user-role-filter" className="label">
              Role絞り込み
            </label>
            <select
              id="admin-user-role-filter"
              name="roleFilter"
              className="input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | Role)}
              disabled={pending}
            >
              <option value="ALL">ALL</option>
              <option value="REQUESTER">REQUESTER</option>
              <option value="APPROVER">APPROVER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div className="text-sm text-gray-600">
            表示件数: {filteredUsers.length} / {users.length}
          </div>
        </div>

        <div className="space-y-2">
          {filteredUsers.map((u) => {
            const draft = usersWithDraft[u.id]
            const changed = draft.role !== u.role || draft.department !== u.department

            const roleId = `admin-user-role-${u.id}`
            const deptId = `admin-user-dept-${u.id}`
            const isSelf = u.id === currentUserId

            return (
              <div key={u.id} className="rounded border p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-gray-500 break-all">id: {u.id}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}
                    >
                      {u.is_active ? '有効' : '無効'}
                    </span>

                    {isSelf && (
                      <span className="text-xs text-gray-500">
                        自分自身は無効化できません
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div>
                    <label htmlFor={roleId} className="label">
                      Role
                    </label>
                    <select
                      id={roleId}
                      name={`role-${u.id}`}
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
                    <label htmlFor={deptId} className="label">
                      Department
                    </label>
                    <input
                      id={deptId}
                      name={`department-${u.id}`}
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

                  <div className="flex gap-2 flex-wrap">
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

                    <button
                      className={u.is_active ? 'btn btn-secondary' : 'btn btn-primary'}
                      disabled={pending || isSelf}
                      onClick={() =>
                        setDialog({
                          title: u.is_active
                            ? 'このユーザーを無効化しますか？'
                            : 'このユーザーを再有効化しますか？',
                          description: u.is_active
                            ? '無効化すると、このユーザーはアプリの保護画面を利用できなくなります。既存の申請・承認履歴は保持されます。'
                            : '再有効化すると、このユーザーは再びアプリを利用できるようになります。',
                          destructive: u.is_active,
                          run: () => updateUserActive(u.id, !u.is_active),
                        })
                      }
                    >
                      {u.is_active ? '無効化' : '再有効化'}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  現在: {u.role} / {u.department} / {u.is_active ? '有効' : '無効'}
                </div>
              </div>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="rounded border p-3 bg-white text-sm text-gray-600">
              一致するユーザーはいません。
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="font-semibold">管理操作監査ログ（最新20件）</div>
        <div className="text-xs text-gray-600">
          招待、権限変更、部署変更、有効状態変更、申請種別の追加・変更・削除を記録します。
        </div>

        <div className="space-y-2">
          {auditLogs.map((log) => {
            const actor = profileMap[log.actor_id]
            const actorText = actor
              ? `${actor.name} (${actor.role} / ${actor.department})`
              : log.actor_id

            return (
              <div key={log.id} className="rounded border p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-medium">{actionLabel(log.action)}</div>
                    <div className="text-xs text-gray-600">実行者: {actorText}</div>
                    <div className="text-xs text-gray-600">
                      対象: {targetLabel(log, profileMap)}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString('ja-JP')}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded border p-2 bg-gray-50">
                    <div className="font-medium text-gray-700 mb-1">Before</div>
                    <div className="text-gray-600 whitespace-pre-wrap">
                      {summarizeData(log.before_data)}
                    </div>
                  </div>

                  <div className="rounded border p-2 bg-gray-50">
                    <div className="font-medium text-gray-700 mb-1">After</div>
                    <div className="text-gray-600 whitespace-pre-wrap">
                      {summarizeData(log.after_data)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {auditLogs.length === 0 && (
            <div className="rounded border p-3 bg-white text-sm text-gray-600">
              監査ログはまだありません。
            </div>
          )}
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