// app/requests/new/actions.ts
'use server'

import { requireRole } from '@/lib/authz'

export type CreateRequestInput = {
  typeId: number
  title: string
  description: string
  amount?: string
  neededBy?: string
}

function parseAmount(input?: string): number | null {
  const raw = (input ?? '').trim()
  if (!raw) return null

  const normalized = raw.replace(/,/g, '')
  const num = Number(normalized)

  if (Number.isNaN(num)) {
    throw new Error('金額が数値ではありません')
  }

  return num
}

export async function createDraftRequest(input: CreateRequestInput) {
  const { supabase, user, profile } = await requireRole(['REQUESTER', 'ADMIN'])

  if (!profile.department) {
    throw new Error('profiles.department not found')
  }

  const amountNum = parseAmount(input.amount)

  const insertPayload = {
    type_id: input.typeId,
    title: input.title.trim(),
    description: input.description.trim(),
    amount: amountNum,
    needed_by: input.neededBy && input.neededBy !== '' ? input.neededBy : null,
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