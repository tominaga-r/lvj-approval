// app/auth/confirmed/ConfirmedClient.tsx
'use client'

import { useEffect } from 'react'

export default function ConfirmedClient({ next }: { next: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(next)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [next])

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-bold">認証が完了しました</h1>
      <p className="text-sm text-gray-700">
        認証情報を確認しました。画面を移動しています。
      </p>
    </div>
  )
}