// lib/authz.ts
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'

export async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  return { supabase, user: auth.user }
}

export async function requireProfile() {
  const { supabase, user } = await requireUser()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, role, department, is_active')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    // DB triggerで作られる前提なので、ここに来たらDB/Seederの不整合
    throw new Error(error?.message ?? 'profile not found')
  }

  if (!profile.is_active) {
    redirect('/login?error=inactive')
  }

  return { supabase, user, profile }
}

export async function requireRole(roles: Role[]) {
  const { supabase, user, profile } = await requireProfile()

  if (!roles.includes(profile.role as Role)) redirect('/dashboard')

  return { supabase, user, profile }
}