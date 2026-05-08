// app/admin/page.tsx
import { requireRole } from '@/lib/authz'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

type RequestTypeRow = {
  id: number
  name: string
  created_at: string
}

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

export default async function AdminPage() {
  const { supabase, profile } = await requireRole(['ADMIN'])

  const { data: requestTypes, error: rtErr } = await supabase
    .from('request_types')
    .select('id, name, created_at')
    .order('id', { ascending: true })

  if (rtErr) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-red-600">
        request_types取得エラー: {rtErr.message}
      </div>
    )
  }

  const { data: users, error: uErr } = await supabase
    .from('profiles')
    .select('id, name, role, department, is_active, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (uErr) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-red-600">
        profiles取得エラー: {uErr.message}
      </div>
    )
  }

  const { data: auditLogs, error: auditErr } = await supabase
    .from('admin_audit_logs')
    .select(
      'id, actor_id, action, target_user_id, entity_type, entity_id, before_data, after_data, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(20)

  if (auditErr) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-red-600">
        admin_audit_logs取得エラー: {auditErr.message}
      </div>
    )
  }

  const profileIds = Array.from(
    new Set(
      [
        ...(users ?? []).map((u) => u.id),
        ...((auditLogs ?? []).map((l) => l.actor_id).filter(Boolean) as string[]),
        ...((auditLogs ?? [])
          .map((l) => l.target_user_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0) as string[]),
      ].filter(Boolean)
    )
  )

  let profileMap: Record<string, { name: string; role: Role; department: string }> = {}

  if (profileIds.length > 0) {
    const { data: auditProfiles, error: apErr } = await supabase
      .from('profiles')
      .select('id, name, role, department')
      .in('id', profileIds)

    if (apErr) {
      return (
        <div className="max-w-6xl mx-auto p-6 text-red-600">
          監査ログ用profiles取得エラー: {apErr.message}
        </div>
      )
    }

    profileMap = Object.fromEntries(
      (auditProfiles ?? []).map((p) => [
        p.id,
        { name: p.name, role: p.role, department: p.department },
      ])
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">管理（ADMIN）</h1>
      <AdminClient
        requestTypes={(requestTypes ?? []) as RequestTypeRow[]}
        users={(users ?? []) as UserRow[]}
        auditLogs={(auditLogs ?? []) as AdminAuditLogRow[]}
        profileMap={profileMap}
        currentUserId={profile.id}
      />
    </div>
  )
}