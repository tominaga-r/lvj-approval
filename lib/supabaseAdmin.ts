// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return { url, serviceRoleKey }
}

export function createSupabaseAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseAdminClient must not be used on the client')
  }

  const { url, serviceRoleKey } = getSupabaseAdminEnv()

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}