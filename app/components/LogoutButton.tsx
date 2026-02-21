// app/components/LogoutButton.tsx
'use client'

import { supabase } from '@/lib/supabaseClient'

export default function LogoutButton() {
  const onLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button onClick={onLogout} className="text-red-600 hover:underline">
      ログアウト
    </button>
  )
}