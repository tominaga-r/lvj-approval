// app/requests/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function submitRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('submit_request', {
    p_request_id: requestId,
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${requestId}`)
}

export async function cancelRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('cancel_request', {
    p_request_id: requestId,
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${requestId}`)
}

export async function approveRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('decide_request', {
    p_request_id: requestId,
    p_decision: 'APPROVE',
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${requestId}`)
}

export async function rejectRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('decide_request', {
    p_request_id: requestId,
    p_decision: 'REJECT',
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${requestId}`)
}

export async function updateDraftRequest(
  requestId: string,
  input: {
    typeId: number
    title: string
    description: string
    amount?: string
    neededBy?: string
  }
) {
  const supabase = await createSupabaseServerClient()

  const amountNum =
    input.amount && input.amount.trim() !== '' ? Number(input.amount) : null
  if (amountNum !== null && Number.isNaN(amountNum)) {
    throw new Error('金額が数値ではありません')
  }

  const payload = {
    type_id: input.typeId,
    title: input.title.trim(),
    description: input.description.trim(),
    amount: amountNum,
    needed_by: input.neededBy && input.neededBy !== '' ? input.neededBy : null,
  }

  const { error } = await supabase
    .from('requests')
    .update(payload)
    .eq('id', requestId)

  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${requestId}`)
}