// app/login/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'register' | 'signin' | 'forgot'>(
    'register'
  )
  const [anonUser, setAnonUser] = useState<any>(null)

  // register 用
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  // signin 用：ユーザー名 or メール共通入力
  const [identifier, setIdentifier] = useState('')

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        const { data: anon } = await supabase.auth.signInAnonymously()
        setAnonUser(anon?.user ?? null)
      } else {
        const u = (await supabase.auth.getUser()).data.user
        setAnonUser(u)
      }
      setLoading(false)
    }
    check()
  }, []) // ← supabase を依存に入れない（要件）

  // ユーザー名から擬似メールの local-part を作る（register と同じルール）
  const makeLoginIdFromUsername = (name: string) => {
    const normalized = name.trim().toLowerCase()
    const base = normalized
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
    return base || 'user_local'
  }

  const syntheticEmail = (name: string) =>
    `${makeLoginIdFromUsername(name)}@local.internal`

const handleRegister = async () => {
  if (!username || !password)
    return alert('ユーザー名とパスワードを入力してください')

  setLoading(true)
  try {
    const body = {
      anon_user_id: anonUser?.id ?? null,
      username,
      password,
      email: email || null,
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json: {
      ok?: boolean
      user_id?: string
      mode?: 'email_with_verification' | 'pseudo_email'
      error?: string
    } = await res.json().catch(() => ({} as any))

    if (!res.ok || !json.ok) {
      throw new Error(json.error || '登録失敗')
    }

    // 本物メールあり → 確認メールからログインしてほしい
    if (json.mode === 'email_with_verification') {
      if (!email) {
        alert(
          '確認メールを送信しました。メール内のリンクを開いてからログインしてください。'
        )
      } else {
        alert(
          '確認メールを送信しました。\n' +
            'メール内のリンクを開いてアカウント作成を完了してください。'
        )
      }

      // 確認用の画面に遷移
      router.push(
        `/email-check?context=signup&email=${encodeURIComponent(
          email || ''
        )}`
      )
      return
    }

    // メール未入力（ダミー @local.internal）パターン
    // これまで通り、その場でログインまで済ませる
    const loginEmail = email || syntheticEmail(username)

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      // （念のため）メール確認必須設定で弾かれた場合のフォールバック
      if (
        error.message?.includes('Email not confirmed') ||
        error.message?.includes('email_not_confirmed')
      ) {
        alert(
          '登録用の確認メールを送信しました。メール内のリンクを開いてから、もう一度ログインしてください。'
        )
        return
      }
      throw error
    }

    alert('登録してログインしました。データは引き継がれています。')
    router.push('/')
  } catch (e: any) {
    console.error(e)
    alert('登録エラー: ' + (e.message ?? e))
  } finally {
    setLoading(false)
  }
}

  const handleSignIn = async () => {
    if (!identifier)
      return alert('ユーザー名またはメールアドレスを入力してください')
    if (!password) return alert('パスワードを入力してください')

    const id = identifier.trim()
    const looksLikeEmail = id.includes('@')

    // メールに見えるならそのまま、そうでなければユーザー名として擬似メール化
    const emailToUse = looksLikeEmail ? id : syntheticEmail(id)

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    })

    if (error) {
      if (
        error.message?.includes('Email not confirmed') ||
        error.message?.includes('email_not_confirmed')
      ) {
        alert(
          '登録時の確認メールのリンクを開いてからログインしてください。'
        )
        return
      }

      // ユーザー名でログインしようとして失敗 → メール登録アカウントの可能性を案内
      if (!looksLikeEmail && error.message?.includes('Invalid login credentials')) {
        alert(
          'メールアドレスで登録したアカウントの場合は、メールアドレスを入力してログインしてください。'
        )
        return
      }

      return alert('ログイン失敗: ' + error.message)
    }

    router.push('/')
  }

  const handleForgot = async () => {
    const target = email.trim()
    if (!target) return alert('登録済みメールを入力してください')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target }),
    })

    // 入力不正（400）だけは素直に出してOK（存在確認にならない）
    if (res.status === 400) {
      const j = await res.json().catch(() => ({}))
      return alert('入力エラー: ' + (j.error ?? 'invalid'))
    }

    // それ以外は常に同じ文言
    alert('該当アカウントが存在する場合、パスワード再設定メールを送信しました。')
  }

  if (loading) return <div className="p-6">準備中...</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">ログイン / 登録</h1>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('register')}
          className={`px-3 py-1 rounded ${
            mode === 'register' ? 'bg-blue-600 text-white' : ''
          }`}
        >
          新規登録
        </button>
        <button
          onClick={() => setMode('signin')}
          className={`px-3 py-1 rounded ${
            mode === 'signin' ? 'bg-blue-600 text-white' : ''
          }`}
        >
          ログイン
        </button>
        <button
          onClick={() => setMode('forgot')}
          className={`px-3 py-1 rounded ${
            mode === 'forgot' ? 'bg-blue-600 text-white' : ''
          }`}
        >
          パスワード再発行
        </button>
      </div>

      {mode === 'register' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            ※ メールは任意です。未設定でもユーザー名で登録・ログインできます。
            <br />
            ただし{' '}
            <strong>
              メール未登録の場合、ユーザー名やパスワードの変更が出来ず、パスワードを忘れても復旧できません。
            </strong>
          </p>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ユーザー名"
            className="w-full p-2 border rounded"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="パスワード"
            className="w-full p-2 border rounded"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メール（任意）"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleRegister}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            ユーザー登録してデータを引き継ぐ
          </button>
        </div>
      )}

      {mode === 'signin' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            ユーザー名またはメールアドレスでログインできます。
            メールアドレスを登録している場合はメールアドレスでログインしてください。
          </p>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="ユーザー名またはメールアドレス"
            className="w-full p-2 border rounded"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="パスワード"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleSignIn}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            ログイン
          </button>
        </div>
      )}

      {mode === 'forgot' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            メールでパスワード再設定を行います。
            <br />
            <strong>※ メールアドレスを登録しているアカウントのみ利用できます。</strong>
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="登録済みメール"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleForgot}
            className="bg-orange-600 text-white px-4 py-2 rounded"
          >
            再発行メール送信
          </button>
        </div>
      )}
    </div>
  )
}
