// app/settings/SettingsClient.tsx
'use client'

import { useState, useTransition } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/app/components/ui/ToastProvider'

type Profile = {
  id: string
  name: string
  role: 'REQUESTER' | 'APPROVER' | 'ADMIN'
  department: string
}

export default function SettingsClient({ profile }: { profile: Profile }) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const logout = () => {
    startTransition(async () => {
      const { error } = await supabase.auth.signOut()
      if (error) return toast({ message: `ログアウト失敗: ${error.message}` })
      window.location.href = '/login'
    })
  }

  const updateEmail = () => {
    const e = newEmail.trim().toLowerCase()
    if (!e) return toast({ message: '新しいメールアドレスを入力してください' })
    if (e.endsWith('@local.internal')) return toast({ message: 'そのメールアドレスは使用できません' })

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEmail: e }),
        })

        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
          return toast({ message: `更新失敗: ${j.error ?? res.statusText}` })
        }

        toast({ message: '確認メールを送信しました。受信箱を確認してください。' })
        setNewEmail('')
      } catch (err: any) {
        toast({ message: `更新失敗: ${err?.message ?? err}` })
      }
    })
  }

  const updatePassword = () => {
    if (!newPassword) return toast({ message: '新しいパスワードを入力してください' })
    if (newPassword.length < 8) return toast({ message: 'パスワードは8文字以上にしてください' })

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return toast({ message: `更新失敗: ${error.message}` })

      toast({ message: 'パスワードを更新しました。' })
      setNewPassword('')
    })
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-2">
        <div className="text-sm text-gray-600">ログイン情報</div>
        <div className="text-sm">
          <div>
            <span className="text-gray-500">Name：</span>
            {profile.name}
          </div>
          <div>
            <span className="text-gray-500">Role：</span>
            {profile.role}
          </div>
          <div>
            <span className="text-gray-500">Department：</span>
            {profile.department}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="font-medium">メールアドレス変更</div>
        <input
          className="input"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="new-email@example.com"
          disabled={pending}
        />
        <button className="btn btn-primary" onClick={updateEmail} disabled={pending}>
          {pending ? '処理中...' : '変更メールを送信'}
        </button>
        <p className="text-xs text-gray-500">
          変更は確認メールのリンクをクリックして確定します。
        </p>
      </div>

      <div className="card space-y-3">
        <div className="font-medium">パスワード変更</div>
        <input
          className="input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="8文字以上"
          disabled={pending}
        />
        <button className="btn btn-primary" onClick={updatePassword} disabled={pending}>
          {pending ? '処理中...' : 'パスワード更新'}
        </button>
      </div>

      <div className="flex">
        <button className="btn btn-secondary" onClick={logout} disabled={pending}>
          ログアウト
        </button>
      </div>
    </div>
  )
}
