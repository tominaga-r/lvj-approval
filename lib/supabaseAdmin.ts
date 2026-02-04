// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js'

export const createSupabaseAdmin = () => {
  // 1. クライアントバンドルに混ざったら即クラッシュさせる
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseAdmin must not be used on the client')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 2. env が設定されていない場合も即エラー
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin environment variables (SUPABASE_SERVICE_ROLE_KEY)'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false }, // セッションはサーバー側で保持しない
  })
}
