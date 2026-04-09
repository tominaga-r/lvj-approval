// app/auth/reset-password/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { normalizeErrorMessage } from '@/lib/error'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()

        const cleanUrl = window.location.pathname + window.location.search
        window.history.replaceState(null, '', cleanUrl)

        if (!data.session || sessionError) {
          if (cancelled) return
          setError(
            'このパスワード再設定リンクは無効か、期限切れの可能性があります。\nもう一度パスワード再設定メールを送信してください。'
          )
        }
      } catch (e: unknown) {
        console.error('getSession error:', e)
        if (cancelled) return

        const cleanUrl = window.location.pathname + window.location.search
        window.history.replaceState(null, '', cleanUrl)

        setError(
          '認証情報を確認できませんでした。\nもう一度パスワード再設定メールを送信してください。'
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    setError(null)
    setMessage(null)

    const p = password
    const pc = passwordConfirm

    if (!p || !pc) {
      setError('新しいパスワードと確認用パスワードを入力してください。')
      return
    }
    if (p !== pc) {
      setError('確認用パスワードが一致しません。')
      return
    }
    if (p.length < 8) {
      setError('パスワードは8文字以上にしてください。')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: p })

      if (updateError) {
        const msg = (updateError.message ?? '').toLowerCase()
        if (
          msg.includes('recovery') ||
          msg.includes('session') ||
          msg.includes('token') ||
          msg.includes('expired')
        ) {
          setError(
            'このパスワード再設定リンクは無効か、期限切れの可能性があります。\nもう一度パスワード再設定メールを送信してください。'
          )
        } else {
          setError(`パスワード更新に失敗しました: ${updateError.message}`)
        }
        return
      }

      await supabase.auth.signOut()

      setMessage('パスワードを更新しました。新しいパスワードでログインしてください。')

      setTimeout(() => {
        router.push('/login')
      }, 800)
    } catch (e: unknown) {
      console.error('reset-password error:', e)
      setError(normalizeErrorMessage(e, 'パスワード更新中に予期しないエラーが発生しました。'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">パスワード再設定</h1>

      <p className="mb-4 text-sm text-gray-700 leading-relaxed">
        メールに記載されているリンクからこのページを開いた場合、下のフォームで新しいパスワードを設定できます。
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 whitespace-pre-line">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">新しいパスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">新しいパスワード（確認用）</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="w-full p-2 border rounded"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !!message}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          {loading ? '更新中...' : 'パスワードを更新する'}
        </button>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <p>※ このページを直接開いた場合や、古いリンクを開いた場合はエラーになることがあります。</p>
        <p>その際は、ログイン画面からあらためて「パスワード再発行」を行ってください。</p>
      </div>
    </div>
  )
}