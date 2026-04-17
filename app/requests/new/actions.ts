// app/requests/new/actions.ts
'use server'

import { requireRole } from '@/lib/authz'
import { parseOptionalRequestAmount, requestInputSchema } from '@/lib/validation'

export type CreateRequestInput = {
  typeId: number
  title: string
  description: string
  amount?: string
  neededBy?: string
}

export async function createDraftRequest(input: CreateRequestInput) {
  const { supabase, user, profile } = await requireRole(['REQUESTER', 'ADMIN'])

  if (!profile.department) {
    throw new Error('profiles.department not found')
  }

  const parsed = requestInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '入力が不正です')
  }

  const amountNum = parseOptionalRequestAmount(parsed.data.amount)

  const insertPayload = {
    type_id: parsed.data.typeId,
    title: parsed.data.title,
    description: parsed.data.description,
    amount: amountNum,
    needed_by: parsed.data.neededBy,
    requester_id: user.id,
    department: profile.department,
  }

  const { data: created, error } = await supabase
    .from('requests')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  return { id: created.id }
}