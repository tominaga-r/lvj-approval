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