// app/admin/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { z } from 'zod'

const requestTypeNameSchema = z
  .string()
  .trim()
  .min(1, '種別名は必須です')
  .max(50, '種別名が長すぎます')

const roleSchema = z.enum(['REQUESTER', 'APPROVER', 'ADMIN'])
const deptSchema = z.string().trim().min(1, '部署は必須です').max(50, '部署が長すぎます')

export async function createRequestType(name: string) {
  const { supabase } = await requireRole(['ADMIN'])
  const parsed = requestTypeNameSchema.safeParse(name)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid')

  const { error } = await supabase.from('request_types').insert({ name: parsed.data })
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/requests/new') // 種別プルダウン反映
}

export async function renameRequestType(id: number, name: string) {
  const { supabase } = await requireRole(['ADMIN'])
  const parsed = requestTypeNameSchema.safeParse(name)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'invalid')

  const { error } = await supabase
    .from('request_types')
    .update({ name: parsed.data })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/requests/new')
}

export async function deleteRequestType(id: number) {
  const { supabase } = await requireRole(['ADMIN'])
  // 参照整合性で消せない場合がある（requests.type_id参照）
  const { error } = await supabase.from('request_types').delete().eq('id', id)
  if (error) {
    const msg = String((error as any).message ?? error)

    // PostgREST/SupabaseのFK制約系メッセージを分かりやすくする
    if (msg.includes('violates foreign key constraint') || msg.includes('23503')) {
      throw new Error('この種別は申請で使用されているため削除できません。')
    }

    throw new Error(msg)
  }

  revalidatePath('/admin')
  revalidatePath('/requests/new')
}

export async function updateUserRoleDepartment(
  userId: string,
  role: 'REQUESTER' | 'APPROVER' | 'ADMIN',
  department: string
) {
  const { supabase } = await requireRole(['ADMIN'])

  const r = roleSchema.safeParse(role)
  if (!r.success) throw new Error('roleが不正です')

  const d = deptSchema.safeParse(department)
  if (!d.success) throw new Error(d.error.issues[0]?.message ?? 'departmentが不正です')

  const { error } = await supabase
    .from('profiles')
    .update({ role: r.data, department: d.data })
    .eq('id', userId)

  // DB側に「非ADMINはrole/department変更不可」トリガーあり。ADMINはOK。
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/approvals')
  revalidatePath('/requests')
}