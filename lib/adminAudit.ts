// lib/adminAudit.ts
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin'

type AdminAuditInput = {
  actorId: string
  action:
    | 'INVITE_USER'
    | 'UPDATE_USER_ROLE'
    | 'UPDATE_USER_DEPARTMENT'
    | 'UPDATE_USER_ACTIVE'
    | 'CREATE_REQUEST_TYPE'
    | 'RENAME_REQUEST_TYPE'
    | 'DELETE_REQUEST_TYPE'
  entityType: 'profiles' | 'request_types' | 'auth.users'
  entityId?: string | null
  targetUserId?: string | null
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
}

export async function writeAdminAuditLog(input: AdminAuditInput) {
  const admin = createSupabaseAdminClient()

  const { error } = await admin.from('admin_audit_logs').insert({
    actor_id: input.actorId,
    action: input.action,
    target_user_id: input.targetUserId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }
}