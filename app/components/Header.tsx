// app/components/Header.tsx
import Link from 'next/link'
import LogoutButton from './LogoutButton'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'

export default async function Header() {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()

  const user = auth.user
  if (!user) {
    // 未ログイン時：リンクは最小
    return (
      <header className="fixed top-0 inset-x-0 z-40 border-b bg-white">
        <div className="max-w-5xl mx-auto flex justify-between items-center px-4 h-14">
          <Link href="/" className="font-bold hover:underline">
            Approval
          </Link>
          <Link href="/login" className="text-blue-600 hover:underline text-sm">
            ログイン
          </Link>
        </div>
      </header>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, department')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'REQUESTER') as Role
  const isApprover = role === 'APPROVER'
  const isAdmin = role === 'ADMIN'
  const displayName = profile?.name ?? 'User'
  const dept = profile?.department ?? ''

  const links: { href: string; label: string }[] = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/requests', label: '申請' },
  ]
  if (isApprover) links.push({ href: '/approvals', label: '承認待ち' })
  if (isAdmin) links.push({ href: '/admin', label: '管理' })
  links.push({ href: '/settings', label: '設定' })

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b bg-white">
      <div className="max-w-5xl mx-auto flex justify-between items-center px-4 h-14">
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="font-bold hover:underline">
            Approval
          </Link>

          <nav className="flex gap-4 text-sm">
            {links.map((x) => (
              <Link key={x.href} href={x.href} className="hover:underline">
                {x.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">
            {displayName}
            {dept ? ` / ${dept}` : ''}
            {role ? ` / ${role}` : ''}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}