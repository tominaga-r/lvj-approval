// app/components/Header.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface UserMeta {
  username?: string
}

interface SupabaseUser {
  id: string
  email?: string | null
  user_metadata: UserMeta
}

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  // profiles の username（即時反映用）
  const [profileName, setProfileName] = useState<string>('')

  const fetchProfileName = useCallback(async (uid?: string) => {
    const id = uid ?? user?.id
    if (!id) {
      setProfileName('')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      // プロファイルが無い/権限などのケースでは metadata fallback で十分
      setProfileName('')
      return
    }

    setProfileName((data?.username ?? '').trim())
  }, [user?.id])

  useEffect(() => {
    let unsub: (() => void) | null = null

    ;(async () => {
      // 初期ユーザー取得
      const { data } = await supabase.auth.getUser()
      const u = (data?.user as SupabaseUser | null) ?? null
      setUser(u)

      // 初回の表示名取得
      if (u?.id) await fetchProfileName(u.id)

      // 以降のログイン/ログアウト・匿名→本登録などの変化も拾う
      const { data: sub } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          const nextUser = (session?.user as SupabaseUser | null) ?? null
          setUser(nextUser)
          if (nextUser?.id) await fetchProfileName(nextUser.id)
          else setProfileName('')
        }
      )

      unsub = () => sub.subscription.unsubscribe()
      setAuthReady(true)
    })()

    return () => {
      if (unsub) unsub()
    }
  }, [fetchProfileName])

  // 設定更新後に即反映させるためのイベント
  useEffect(() => {
    const onUpdated = () => fetchProfileName()
    window.addEventListener('profile-updated', onUpdated)
    return () => window.removeEventListener('profile-updated', onUpdated)
  }, [fetchProfileName])

  const isAnonymous = user !== null && !user.email

  // 「ログイン/登録」を出す条件
  const showLoginLink = authReady && (!user || isAnonymous)
  // 「ログアウト」を出す条件（本登録ユーザーだけ）
  const showLogout = authReady && !!user && !isAnonymous

  async function handleLogout() {
    if (!authReady) return // 状態確定前は何もしない保険
    await supabase.auth.signOut()

    // SPA の状態を全部捨ててフルリロード
    window.location.href = '/'
  }

  // 表示名：profiles → metadata → 匿名
  const displayName =
    (profileName && profileName.length > 0 ? profileName : undefined) ??
    user?.user_metadata?.username ??
    '匿名ユーザー'

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow z-50">
      <div className="max-w-3xl mx-auto flex justify-between items-center px-4 h-14">

        {/* 左側ナビゲーション */}
        <div className="flex gap-4">
          <Link href="/" className="font-bold hover:underline">
            ホーム
          </Link>

          <Link href="/hidden" className="hover:underline">
            非表示
          </Link>

          {authReady && user && !isAnonymous && (
            <Link href="/settings" className="hover:underline">
              設定
            </Link>
          )}
        </div>

        {/* 右側ユーザー情報 */}
        <div className="flex gap-4 items-center text-sm">
          {/* ユーザー名表示（認証状態がわかってから） */}
          {authReady && user && (
            <span className="text-gray-700">
              {displayName}
            </span>
          )}

          {/* ログアウトボタン（本登録ユーザー） */}
          {showLogout && (
            <button
              onClick={handleLogout}
              className="text-red-600 hover:underline"
            >
              ログアウト
            </button>
          )}

          {/* ログイン / 登録リンク（未ログイン or 匿名） */}
          {showLoginLink && (
            <Link href="/login" className="text-blue-600 hover:underline">
              ログイン / 登録
            </Link>
          )}

          {/* authReady になるまでの間は、何も出さない or プレースホルダ */}
          {!authReady && (
            <span className="text-gray-400 text-xs">ロード中...</span>
          )}
        </div>
      </div>
    </header>
  )
}
