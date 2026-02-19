// app/components/Header.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'
type Profile = { name: string; role: Role; department: string }

export function Header() {
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  // セッション検出
  useEffect(() => {
    let alive = true

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      setUserId(data.session?.user?.id ?? null)
      setAuthReady(true)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // profiles 取得
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!userId) {
        setProfile(null)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('name, role, department')
        .eq('id', userId)
        .single()

      if (cancelled) return

      if (error) {
        console.error('load profile error:', error)
        setProfile(null)
        return
      }

      setProfile(data as Profile)
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const role = profile?.role
  const isApprover = role === 'APPROVER'
  const isAdmin = role === 'ADMIN'
  const displayName = profile?.name ?? 'User'

  const navLinks = useMemo(() => {
    const links: { href: string; label: string }[] = [
      { href: '/dashboard', label: 'ダッシュボード' },
      { href: '/requests', label: '申請' },
    ]
    if (isApprover) links.push({ href: '/approvals', label: '承認待ち' })
    if (isAdmin) links.push({ href: '/admin', label: '管理' })
    links.push({ href: '/settings', label: '設定' }) 
    return links
  }, [isApprover, isAdmin])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b bg-white">
      <div className="max-w-5xl mx-auto flex justify-between items-center px-4 h-14">
        {/* 左：ロゴ＋ナビ */}
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="font-bold hover:underline">
            Approval
          </Link>

          {authReady && userId && (
            <nav className="flex gap-4 text-sm">
              {navLinks.map((x) => (
                <Link key={x.href} href={x.href} className="hover:underline">
                  {x.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* 右：ユーザー表示＋ログイン/アウト */}
        <div className="flex gap-4 items-center text-sm">
          {authReady && userId && (
            <span className="text-gray-700">
              {displayName}
              {profile?.department ? ` / ${profile.department}` : ''}
              {role ? ` / ${role}` : ''}
            </span>
          )}

          {authReady && userId && (
            <button onClick={handleLogout} className="text-red-600 hover:underline">
              ログアウト
            </button>
          )}

          {authReady && !userId && (
            <Link href="/login" className="text-blue-600 hover:underline">
              ログイン
            </Link>
          )}

          {!authReady && <span className="text-gray-400 text-xs">ロード中...</span>}
        </div>
      </div>
    </header>
  )
}