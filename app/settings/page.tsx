// app/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Settings() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  // 新しいパスワード
  const [pw, setPw] = useState('')

  // 現在のパスワード（メール変更・パスワード変更の時に使用）
  const [currentPw, setCurrentPw] = useState('')

  // ユーザー名変更が許可されているか（メール登録済みユーザーだけ）
  const [canChangeUsername, setCanChangeUsername] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        router.push('/login')
        return
      }

      const user = userData.user

      // 匿名ユーザー（email が null）の場合は設定画面を使わせない
      if (!user.email) {
        alert(
          'この画面は本登録済みユーザー用です。\n' +
            '匿名利用のままではメールやパスワードを変更できません。'
        )
        router.push('/') // ホームに戻す（/login に飛ばしてもOK）
        return
      }

      const emailFromAuth = user.email ?? ''
      // 「擬似メール(@local.internal)かどうか」を判定
      const isPseudoEmail = emailFromAuth.endsWith('@local.internal')

      // 入力欄には擬似メールは表示しない（= メール未登録扱い）
      setEmail(isPseudoEmail ? '' : emailFromAuth)

      // 「本物メール登録済みか？」を判定
      // username@local.internal のようなダミーは NG とする
      const hasRealEmail = !!emailFromAuth && !isPseudoEmail
      setCanChangeUsername(hasRealEmail)

      // プロフィール（表示名）
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      setUsername(prof?.username ?? '')
      setLoading(false)
    })()
  }, [router])

  // ユーザー名更新（メール登録ユーザーだけ許可）
  const updateUsername = async () => {
    if (!canChangeUsername) {
      alert('メール登録済みのユーザーのみ、ユーザー名を変更できます。')
      return
    }
    if (!username) return alert('ユーザー名を入力してください')

    const res = await fetch('/api/auth/update-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    const j = await res.json().catch(() => ({}))

    if (!res.ok) {
      return alert('更新失敗: ' + (j.error || JSON.stringify(j)))
    }

    alert('ユーザー名を更新しました')
    window.dispatchEvent(new Event('profile-updated'))
  }

  // メールアドレス更新（現在のパスワード確認付き・サーバー側再認証）
  const updateEmail = async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      alert('新しいメールアドレスを入力してください')
      return
    }
    if (!currentPw) {
      alert('現在のパスワードを入力してください')
      return
    }

    if (trimmed.endsWith('@local.internal')) {
      alert(
        '「@local.internal」はダミードメインです。\n' +
          'Gmail など、実際に受信できるメールアドレスを入力してください。'
      )
      return
    }

    try {
      const res = await fetch('/api/auth/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          currentPassword: currentPw,
        }),
      })

      const j: {
        ok?: boolean
        mode?: 'pseudo_to_real' | 'normal_change'
        error?: string
      } = await res.json().catch(() => ({} as any))

      if (!res.ok || !j.ok) {
        if (j.error === 'wrong_password') {
          alert('現在のパスワードが違います。')
          return
        }
        if (j.error === 'not_authenticated') {
          alert('認証情報が無効です。再ログインしてください。')
          return
        }
        alert('メール更新失敗: ' + (j.error || '不明なエラー'))
        return
      }

      if (j.mode === 'pseudo_to_real') {
        // 匿名 → 本登録
        // ここではサインアウトしない。セッションは維持。
        router.push(
          `/email-check?context=pseudo_to_real&email=${encodeURIComponent(trimmed)}`
        )
      } else {
        // 通常のメール変更（Supabase 標準フロー）
         // ここではサインアウト + 専用ページへ
          await supabase.auth.signOut()

          router.push(
            `/email-change-sent?email=${encodeURIComponent(trimmed)}`
          )
      }

      setCurrentPw('')
    } catch (e) {
      console.error('update-email fetch error:', e)
      alert('メール更新中にエラーが発生しました')
    }
  }

  // パスワード更新（現在のパスワード確認付き）
  const updatePassword = async () => {
    if (!currentPw) return alert('現在のパスワードを入力してください')
    if (!pw) return alert('新しいパスワードを入力してください')

    // ログイン中ユーザーのメールを取得して再認証に使う
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      alert('認証情報を取得できませんでした')
      return
    }

    const loginEmail = userData.user.email
    if (!loginEmail) {
      alert(
        'このアカウントは、この画面からはパスワード変更できません。'
      )
      return
    }

    // 現在のパスワードで再認証
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: currentPw,
    })

    if (reauthError) {
      alert('現在のパスワードが違います。')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      alert('パスワード更新失敗: ' + error.message)
      return
    }

    alert('パスワードを更新しました')
    setCurrentPw('')
    setPw('')
  }

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">アカウント設定</h1>

      {/* ユーザー名 */}
      <div className="mb-4">
        <label className="block text-sm mb-1">ユーザー名</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={!canChangeUsername}
        />
        <button
          onClick={updateUsername}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-300 disabled:text-gray-600"
          disabled={!canChangeUsername}
        >
          ユーザー名更新
        </button>
        {!canChangeUsername && (
          <p className="mt-1 text-xs text-gray-500">
            メールアドレスを登録すると、ユーザー名を変更できるようになります。
          </p>
        )}
      </div>

      {/* 現在のパスワード */}
      <div className="mb-4">
        <label className="block text-sm mb-1">現在のパスワード</label>
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <p className="mt-1 text-xs text-gray-500">
          メール変更と新しいパスワード設定のときに使用します。
        </p>
      </div>

      {/* メール */}
      <div className="mb-4">
        <label className="block text-sm mb-1">メール</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={updateEmail}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
        >
          メール登録・変更
        </button>
        <p className="mt-1 text-xs text-gray-500">
          確認メールが送信されるので、リンクをクリックして完了してください。
        </p>
      </div>

      {/* 新しいパスワード */}
      <div>
        <label className="block text-sm mb-1">新しいパスワード</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={updatePassword}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
        >
          パスワード変更
        </button>
      </div>
    </div>
  )
}
