// app/login/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { getBrowserNextPath } from '@/lib/authFlow'
import { normalizeErrorMessage } from '@/lib/error'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [forgotCooldownUntil, setForgotCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!forgotCooldownUntil) return

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 500)

    return () => window.clearInterval(timer)
  }, [forgotCooldownUntil])

  useEffect(() => {
    if (!forgotCooldownUntil) return
    if (Date.now() >= forgotCooldownUntil) {
      setForgotCooldownUntil(null)
    }
  }, [now, forgotCooldownUntil])

  const cooldownActive = useMemo(() => {
    return forgotCooldownUntil !== null && now < forgotCooldownUntil
  }, [forgotCooldownUntil, now])

  const cooldownSec = useMemo(() => {
    if (!forgotCooldownUntil) return 0
    return Math.max(0, Math.ceil((forgotCooldownUntil - now) / 1000))
  }, [forgotCooldownUntil, now])

  const handleSignin = async () => {
    const e = email.trim().toLowerCase()

    setErrorMessage(null)
    setInfoMessage(null)

    if (!e || !password) {
      setErrorMessage('メールアドレスとパスワードを入力してください')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      })

      if (error) {
        setErrorMessage(`ログイン失敗: ${error.message}`)
        return
      }

      window.location.href = getBrowserNextPath('/dashboard')
    } catch (e: unknown) {
      setErrorMessage(normalizeErrorMessage(e, 'ログインに失敗しました'))
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    if (loading || cooldownActive) return

    const target = email.trim().toLowerCase()

    setErrorMessage(null)
    setInfoMessage(null)

    if (!target) {
      setErrorMessage('登録済みメールを入力してください')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })

      const j = await res.json().catch(() => ({}))

      if (res.status === 400) {
        setErrorMessage(`入力エラー: ${j.error ?? 'invalid'}`)
        return
      }

      if (res.status === 429) {
        setForgotCooldownUntil(Date.now() + 60_000)
        setErrorMessage(
          j.error ?? 'メール送信回数の上限に達しました。時間をおいて再試行してください。'
        )
        return
      }

      if (!res.ok) {
        setErrorMessage(`再設定メール送信に失敗しました: ${j.error ?? res.statusText}`)
        return
      }

      setForgotCooldownUntil(Date.now() + 30_000)
      setInfoMessage('該当アカウントが存在する場合、パスワード再設定メールを送信しました。')
      setMode('signin')
    } catch (e: unknown) {
      setErrorMessage(normalizeErrorMessage(e, '再設定メール送信に失敗しました'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">ログイン</h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('signin')
            setErrorMessage(null)
            setInfoMessage(null)
          }}
          className={`px-3 py-1 rounded ${mode === 'signin' ? 'bg-blue-600 text-white' : ''}`}
        >
          ログイン
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('forgot')
            setErrorMessage(null)
            setInfoMessage(null)
          }}
          className={`px-3 py-1 rounded ${mode === 'forgot' ? 'bg-blue-600 text-white' : ''}`}
        >
          パスワード再発行
        </button>
      </div>

      {errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
          {errorMessage}
        </div>
      )}

      {infoMessage && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 whitespace-pre-wrap">
          {infoMessage}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="login-email" className="label">
          メールアドレス
        </label>
        <input
          id="login-email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          disabled={loading}
          autoComplete="email"
        />
      </div>

      {mode === 'signin' && (
        <div className="space-y-2">
          <label htmlFor="login-password" className="label">
            パスワード
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
        </div>
      )}

      {mode === 'signin' ? (
        <button
          type="button"
          className="btn btn-primary w-full justify-center"
          onClick={handleSignin}
          disabled={loading}
        >
          {loading ? '処理中...' : 'ログイン'}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary w-full justify-center"
          onClick={handleForgot}
          disabled={loading || cooldownActive}
        >
          {loading ? '送信中...' : cooldownActive ? `再送まで ${cooldownSec} 秒` : '再設定メールを送る'}
        </button>
      )}

      <p className="text-xs text-gray-500">
        ※ 研修用のため新規登録UIは省略しています。テストユーザーでログインしてください。
      </p>
    </div>
  )
}