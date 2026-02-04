// app/auth/confirmed/ConfirmedClient.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ConfirmedClient({ next }: { next: string }) {
  const ran = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      try {
        // hash から token が来ていれば、ブラウザ側の supabase-js に確実に反映
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash
        const hp = new URLSearchParams(hash)
        const access_token = hp.get('access_token')
        const refresh_token = hp.get('refresh_token')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (error) throw error
          await supabase.auth.getUser() // 念のため
        } else {
          // token が無い場合でも、念のため読み直し（Cookie/LS の差分吸収）
          await supabase.auth.getSession()
          await supabase.auth.getUser()
        }

        // URL から hash を消す（履歴に残しにくくする）
        const clean = window.location.pathname + window.location.search
        window.history.replaceState(null, '', clean)

        // Next.js の古い表示を確実に捨てる
        window.location.replace(next)
      } catch (e: any) {
        console.error(e)
        setError('認証の反映に失敗しました。もう一度ログインしてください。')
      }
    })()
  }, [next])

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-lg font-bold mb-3">認証情報を反映中…</h1>
      <p className="text-sm text-gray-700">
        画面を移動しています。しばらくお待ちください。
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
          {error}
        </div>
      )}
    </div>
  )
}
