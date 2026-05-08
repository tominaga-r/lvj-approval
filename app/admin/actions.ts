// app/admin/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { writeAdminAuditLog } from '@/lib/adminAudit'
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin'
import {
  inviteUserSchema,
  requestTypeNameSchema,
  updateUserRoleDepartmentSchema,
} from '@/lib/validation'

export async function createRequestType(name: string) {
  const { profile } = await requireRole(['ADMIN'])
  const parsed = requestTypeNameSchema.safeParse(name)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid')

  const admin = createSupabaseAdminClient()

  const { data, error } = await admin
    .from('request_types')
    .insert({ name: parsed.data })
    .select('id, name')
    .single()

  if (error) throw new Error(error.message)

  await writeAdminAuditLog({
    actorId: profile.id,
    action: 'CREATE_REQUEST_TYPE',
    entityType: 'request_types',
    entityId: String(data.id),
    afterData: { id: data.id, name: data.name },
  })

  revalidatePath('/admin')
  revalidatePath('/requests/new')
}

export async function renameRequestType(id: number, name: string) {
  const { profile } = await requireRole(['ADMIN'])
  const parsed = requestTypeNameSchema.safeParse(name)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid')

  const admin = createSupabaseAdminClient()

  const { data: beforeRow, error: beforeError } = await admin
    .from('request_types')
    .select('id, name')
    .eq('id', id)
    .single()

  if (beforeError) throw new Error(beforeError.message)

  const { data: afterRow, error } = await admin
    .from('request_types')
    .update({ name: parsed.data })
    .eq('id', id)
    .select('id, name')
    .single()

  if (error) throw new Error(error.message)

  await writeAdminAuditLog({
    actorId: profile.id,
    action: 'RENAME_REQUEST_TYPE',
    entityType: 'request_types',
    entityId: String(id),
    beforeData: { id: beforeRow.id, name: beforeRow.name },
    afterData: { id: afterRow.id, name: afterRow.name },
  })

  revalidatePath('/admin')
  revalidatePath('/requests/new')
}

export async function deleteRequestType(id: number) {
  const { profile } = await requireRole(['ADMIN'])
  const admin = createSupabaseAdminClient()

  const { data: beforeRow, error: beforeError } = await admin
    .from('request_types')
    .select('id, name')
    .eq('id', id)
    .single()

  if (beforeError) throw new Error(beforeError.message)

  const { error } = await admin.from('request_types').delete().eq('id', id)
  if (error) {
    const msg = String((error as { message?: unknown })?.message ?? error)
    if (msg.includes('violates foreign key constraint') || msg.includes('23503')) {
      throw new Error('この種別は申請で使用されているため削除できません。')
    }
    throw new Error(msg)
  }

  await writeAdminAuditLog({
    actorId: profile.id,
    action: 'DELETE_REQUEST_TYPE',
    entityType: 'request_types',
    entityId: String(id),
    beforeData: { id: beforeRow.id, name: beforeRow.name },
  })

  revalidatePath('/admin')
  revalidatePath('/requests/new')
}

export async function updateUserRoleDepartment(
  userId: string,
  role: 'REQUESTER' | 'APPROVER' | 'ADMIN',
  department: string
) {
  const { profile } = await requireRole(['ADMIN'])
  const parsed = updateUserRoleDepartmentSchema.safeParse({ userId, role, department })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid')

  const admin = createSupabaseAdminClient()

  const { data: beforeRow, error: beforeError } = await admin
    .from('profiles')
    .select('id, role, department')
    .eq('id', parsed.data.userId)
    .single()

  if (beforeError) throw new Error(beforeError.message)

  const { data: afterRow, error } = await admin
    .from('profiles')
    .update({
      role: parsed.data.role,
      department: parsed.data.department,
    })
    .eq('id', parsed.data.userId)
    .select('id, role, department')
    .single()

  if (error) throw new Error(error.message)

  if (beforeRow.role !== afterRow.role) {
    await writeAdminAuditLog({
      actorId: profile.id,
      action: 'UPDATE_USER_ROLE',
      entityType: 'profiles',
      entityId: parsed.data.userId,
      targetUserId: parsed.data.userId,
      beforeData: { role: beforeRow.role },
      afterData: { role: afterRow.role },
    })
  }

  if (beforeRow.department !== afterRow.department) {
    await writeAdminAuditLog({
      actorId: profile.id,
      action: 'UPDATE_USER_DEPARTMENT',
      entityType: 'profiles',
      entityId: parsed.data.userId,
      targetUserId: parsed.data.userId,
      beforeData: { department: beforeRow.department },
      afterData: { department: afterRow.department },
    })
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/approvals')
  revalidatePath('/requests')
}

export async function updateUserActive(userId: string, isActive: boolean) {
  const { profile } = await requireRole(['ADMIN'])

  if (!userId || typeof userId !== 'string') {
    throw new Error('invalid user id')
  }

  if (typeof isActive !== 'boolean') {
    throw new Error('invalid active flag')
  }

  if (userId === profile.id && !isActive) {
    throw new Error('自分自身は無効化できません。')
  }

  const admin = createSupabaseAdminClient()

  const { data: beforeRow, error: beforeError } = await admin
    .from('profiles')
    .select('id, name, role, department, is_active')
    .eq('id', userId)
    .single()

  if (beforeError) throw new Error(beforeError.message)

  const { data: afterRow, error } = await admin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id, name, role, department, is_active')
    .single()

  if (error) throw new Error(error.message)

  if (beforeRow.is_active !== afterRow.is_active) {
    await writeAdminAuditLog({
      actorId: profile.id,
      action: 'UPDATE_USER_ACTIVE',
      entityType: 'profiles',
      entityId: userId,
      targetUserId: userId,
      beforeData: {
        is_active: beforeRow.is_active,
        name: beforeRow.name,
        role: beforeRow.role,
        department: beforeRow.department,
      },
      afterData: {
        is_active: afterRow.is_active,
        name: afterRow.name,
        role: afterRow.role,
        department: afterRow.department,
      },
    })
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/approvals')
  revalidatePath('/requests')
}

export async function inviteUser(input: {
  email: string
  name: string
  role: 'REQUESTER' | 'APPROVER' | 'ADMIN'
  department: string
}) {
  const { profile } = await requireRole(['ADMIN'])

  const parsed = inviteUserSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid')

  const admin = createSupabaseAdminClient()

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  const redirectTo = baseUrl ? `${baseUrl}/auth/confirmed?next=/login` : undefined

  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      name: parsed.data.name,
      role: parsed.data.role,
      department: parsed.data.department,
    },
    ...(redirectTo ? { redirectTo } : {}),
  })

  if (error) throw new Error(error.message)

  const invitedUserId = data.user?.id
  if (!invitedUserId) {
    throw new Error('招待ユーザーIDを取得できませんでした')
  }

  const { error: upsertError } = await admin.from('profiles').upsert(
    {
      id: invitedUserId,
      name: parsed.data.name,
      role: parsed.data.role,
      department: parsed.data.department,
      is_active: true,
    },
    { onConflict: 'id' }
  )

  if (upsertError) throw new Error(upsertError.message)

  await writeAdminAuditLog({
    actorId: profile.id,
    action: 'INVITE_USER',
    entityType: 'auth.users',
    entityId: invitedUserId,
    targetUserId: invitedUserId,
    afterData: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      department: parsed.data.department,
      is_active: true,
    },
  })

  revalidatePath('/admin')
}