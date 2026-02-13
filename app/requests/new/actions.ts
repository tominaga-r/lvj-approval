// app/requests/new/actions.ts

'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

type CreateRequestInput = {
  typeId: number
  title: string
  description: string
  amount?: string
  neededBy?: string
}

export async function createDraftRequest(input: CreateRequestInput) {
  const supabase = await createSupabaseServerClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  // 自分のdepartmentを取得（RLSのinsert条件に合わせる）
  const { data: me, error: meErr } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', auth.user.id)
    .single()

  if (meErr || !me?.department) {
    throw new Error(meErr?.message ?? 'profiles.department not found')
  }

  const amountNum =
    input.amount && input.amount.trim() !== '' ? Number(input.amount) : null
  if (amountNum !== null && Number.isNaN(amountNum)) {
    throw new Error('金額が数値ではありません')
  }

  const insertPayload: any = {
    type_id: input.typeId,
    title: input.title.trim(),
    description: input.description.trim(),
    amount: amountNum,
    needed_by: input.neededBy && input.neededBy !== '' ? input.neededBy : null,
    requester_id: auth.user.id,
    department: me.department,
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
