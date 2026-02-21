// app/requests/new/actions.ts
'use server'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/authz'

type CreateRequestInput = {
  typeId: number
  title: string
  description: string
  amount?: string
  neededBy?: string
}

export async function createDraftRequest(input: CreateRequestInput) {
  const { supabase, user, profile } = await requireRole(['REQUESTER', 'ADMIN'])

  // departmentが無いとINSERT条件に合わないので早めに落とす
  if (!profile.department) {
    throw new Error('profiles.department not found')
  }

  const amountNum =
    input.amount && input.amount.trim() !== '' ? Number(input.amount) : null
  if (amountNum !== null && Number.isNaN(amountNum)) {
    throw new Error('金額が数値ではありません')
  }

  const insertPayload = {
    type_id: input.typeId,
    title: input.title.trim(),
    description: input.description.trim(),
    amount: amountNum,
    needed_by: input.neededBy && input.neededBy !== '' ? input.neededBy : null,
    requester_id: user.id,
    department: profile.department,
    // status はテーブルdefaultで DRAFT
  }

  const { data: created, error } = await supabase
    .from('requests')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  redirect(`/requests/${created.id}`)
}
