// app/requests/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  optionalDecisionCommentSchema,
  parseOptionalRequestAmount,
  requestInputSchema,
  requiredDecisionCommentSchema,
  uuidSchema,
} from '@/lib/validation'

function parseRequestId(requestId: string) {
  return uuidSchema.parse(requestId)
}

export async function submitRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const parsedRequestId = parseRequestId(requestId)
  const parsedComment = optionalDecisionCommentSchema.parse(comment)

  const { error } = await supabase.rpc('submit_request', {
    p_request_id: parsedRequestId,
    p_comment: parsedComment,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${parsedRequestId}`)
}

export async function cancelRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const parsedRequestId = parseRequestId(requestId)
  const parsedComment = optionalDecisionCommentSchema.parse(comment)

  const { error } = await supabase.rpc('cancel_request', {
    p_request_id: parsedRequestId,
    p_comment: parsedComment,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${parsedRequestId}`)
}

export async function approveRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const parsedRequestId = parseRequestId(requestId)
  const parsedComment = optionalDecisionCommentSchema.parse(comment)

  const { error } = await supabase.rpc('decide_request', {
    p_request_id: parsedRequestId,
    p_decision: 'APPROVE',
    p_comment: parsedComment,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${parsedRequestId}`)
}

export async function rejectRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const parsedRequestId = parseRequestId(requestId)
  const parsedComment = requiredDecisionCommentSchema.parse(comment)

  const { error } = await supabase.rpc('decide_request', {
    p_request_id: parsedRequestId,
    p_decision: 'REJECT',
    p_comment: parsedComment,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${parsedRequestId}`)
}

export async function returnRequest(requestId: string, comment?: string) {
  const supabase = await createSupabaseServerClient()
  const parsedRequestId = parseRequestId(requestId)
  const parsedComment = requiredDecisionCommentSchema.parse(comment)

  const { error } = await supabase.rpc('return_request', {
    p_request_id: parsedRequestId,
    p_comment: parsedComment,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${parsedRequestId}`)
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
  const parsedRequestId = parseRequestId(requestId)

  const parsedInput = requestInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new Error(parsedInput.error.issues[0]?.message ?? '入力が不正です')
  }

  const amountNum = parseOptionalRequestAmount(parsedInput.data.amount)

  const payload = {
    type_id: parsedInput.data.typeId,
    title: parsedInput.data.title,
    description: parsedInput.data.description,
    amount: amountNum,
    needed_by: parsedInput.data.neededBy,
  }

  const { error } = await supabase.from('requests').update(payload).eq('id', parsedRequestId)

  if (error) throw new Error(error.message)

  revalidatePath('/requests')
  revalidatePath('/approvals')
  revalidatePath(`/requests/${parsedRequestId}`)
}