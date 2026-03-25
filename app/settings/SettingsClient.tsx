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
  const [reauthCode, setReauthCode] = useState('')
  const [reauthSent, setReauthSent] = useState(false)

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

  const sendReauthCode = () => {
    if (!newPassword) return toast({ message: '先に新しいパスワードを入力してください' })
    if (newPassword.length < 8) {
      return toast({ message: 'パスワードは8文字以上にしてください' })
    }

    startTransition(async () => {
      const { error } = await supabase.auth.reauthenticate()
      if (error) {
        return toast({ message: `再認証コード送信失敗: ${error.message}` })
      }

      setReauthSent(true)
      toast({ message: '再認証コードを送信しました。メールを確認してください。' })
    })
  }

  const updatePassword = () => {
    if (!newPassword) return toast({ message: '新しいパスワードを入力してください' })
    if (newPassword.length < 8) {
      return toast({ message: 'パスワードは8文字以上にしてください' })
    }
    if (!reauthCode.trim()) {
      return toast({ message: 'メールで届いた再認証コードを入力してください' })
    }

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        nonce: reauthCode.trim(),
      })

      if (error) {
        return toast({ message: `更新失敗: ${error.message}` })
      }

      toast({ message: 'パスワードを更新しました。' })
      setNewPassword('')
      setReauthCode('')
      setReauthSent(false)
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

        <div>
          <label htmlFor="settings-new-email" className="label">
            新しいメールアドレス
          </label>
          <input
            id="settings-new-email"
            name="newEmail"
            className="input"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new-email@example.com"
            disabled={pending}
          />
        </div>

        <button className="btn btn-primary" onClick={updateEmail} disabled={pending}>
          {pending ? '処理中...' : '変更メールを送信'}
        </button>
        <p className="text-xs text-gray-500">変更は確認メールのリンクをクリックして確定します。</p>
      </div>

      <div className="card space-y-3">
        <div className="font-medium">パスワード変更</div>

        <div>
          <label htmlFor="settings-new-password" className="label">
            新しいパスワード
          </label>
          <input
            id="settings-new-password"
            name="newPassword"
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8文字以上"
            disabled={pending}
          />
        </div>

        <button className="btn btn-secondary" onClick={sendReauthCode} disabled={pending}>
          {pending ? '送信中...' : '再認証コードを送信'}
        </button>

        {reauthSent && (
          <>
            <div>
              <label htmlFor="settings-reauth-code" className="label">
                メールで届いた再認証コード
              </label>
              <input
                id="settings-reauth-code"
                name="reauthCode"
                className="input"
                type="text"
                inputMode="numeric"
                value={reauthCode}
                onChange={(e) => setReauthCode(e.target.value)}
                placeholder="6桁コード"
                disabled={pending}
              />
            </div>

            <button className="btn btn-primary" onClick={updatePassword} disabled={pending}>
              {pending ? '処理中...' : 'パスワード更新'}
            </button>
          </>
        )}

        <p className="text-xs text-gray-500">
          パスワード変更前に、登録メールアドレスへ再認証コードを送信します。
        </p>
      </div>

      <div className="flex">
        <button className="btn btn-secondary" onClick={logout} disabled={pending}>
          ログアウト
        </button>
      </div>
    </div>
  )
}