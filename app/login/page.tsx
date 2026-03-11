// app/login/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [loading, setLoading] = useState(false)

  // signin
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSignin = async () => {
    const e = email.trim()
    if (!e || !password) return alert('メールアドレスとパスワードを入力してください')

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      })
      if (error) return alert('ログイン失敗: ' + error.message)

      // Header が server component のため、確実に反映させる目的でフルリロード
      window.location.href = '/dashboard'
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    const target = email.trim()
    if (!target) return alert('登録済みメールを入力してください')

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })

      if (res.status === 400) {
        const j = await res.json().catch(() => ({}))
        return alert('入力エラー: ' + (j.error ?? 'invalid'))
      }

      alert('該当アカウントが存在する場合、パスワード再設定メールを送信しました。')
      setMode('signin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">ログイン</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setMode('signin')}
          className={`px-3 py-1 rounded ${mode === 'signin' ? 'bg-blue-600 text-white' : ''}`}
        >
          ログイン
        </button>
        <button
          onClick={() => setMode('forgot')}
          className={`px-3 py-1 rounded ${mode === 'forgot' ? 'bg-blue-600 text-white' : ''}`}
        >
          パスワード再発行
        </button>
      </div>

      <div className="card space-y-3">
        <div>
          <label htmlFor="email" className="label">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={loading}
          />
        </div>

        {mode === 'signin' && (
          <div>
            <label htmlFor="password" className="label">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {mode === 'signin' ? (
          <button className="btn btn-primary" onClick={handleSignin} disabled={loading}>
            {loading ? '処理中...' : 'ログイン'}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleForgot} disabled={loading}>
            {loading ? '送信中...' : '再設定メールを送る'}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        ※ 研修用のため新規登録UIは省略しています。テストユーザーでログインしてください。
      </p>
    </div>
  )
}