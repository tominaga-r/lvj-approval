// app/admin/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/authz'
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin'
import { writeAdminAuditLog } from '@/lib/adminAudit'

const requestTypeNameSchema = z.string().trim().min(1, '申請種別名は必須です').max(100, '申請種別名が長すぎます')

const updateUserSchema = z.object({
  userId: z.string().uuid('不正なユーザーIDです'),
  role: z.enum(['REQUESTER', 'APPROVER', 'ADMIN']),
  department: z.string().trim().min(1, '部署は必須です').max(100, '部署が長すぎます'),
})

const inviteUserSchema = z.object({
  email: z.email('メールアドレス形式が不正です').transform((v) => v.trim().toLowerCase()),
  name: z.string().trim().min(1, '氏名は必須です').max(100, '氏名が長すぎます'),
  role: z.enum(['REQUESTER', 'APPROVER', 'ADMIN']),
  department: z.string().trim().min(1, '部署は必須です').max(100, '部署が長すぎます'),
})

export async function createRequestType(name: string) {
  const { profile } = await requireRole(['ADMIN'])
  const parsed = requestTypeNameSchema.safeParse(name)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'validation error')

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
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'validation error')

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
  if (error) throw new Error(error.message)

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
  const parsed = updateUserSchema.safeParse({ userId, role, department })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'validation error')

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
  revalidatePath('/requests')
  revalidatePath('/approvals')
}

export async function inviteUser(input: {
  email: string
  name: string
  role: 'REQUESTER' | 'APPROVER' | 'ADMIN'
  department: string
}) {
  const { profile } = await requireRole(['ADMIN'])

  const parsed = inviteUserSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'validation error')

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
    },
  })

  revalidatePath('/admin')
}