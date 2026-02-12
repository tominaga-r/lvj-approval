// app/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, role, department')
    .eq('id', auth.user.id)
    .single()

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-3">Dashboard</h1>
        <p className="text-red-600">profiles を取得できません: {error.message}</p>
      </div>
    )
  }

  const isAdmin = profile.role === 'ADMIN'
  const isApprover = profile.role === 'APPROVER'

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">申請・承認ダッシュボード</h1>

      <div className="rounded border p-4 bg-white">
        <div>名前: {profile.name}</div>
        <div>ロール: {profile.role}</div>
        <div>部署: {profile.department}</div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link className="btn btn-primary" href="/requests">申請一覧</Link>
        <Link className="btn btn-secondary" href="/requests/new">新規申請（下書き）</Link>
        {isApprover && <Link className="btn btn-secondary" href="/approvals">承認待ち</Link>}
        {isAdmin && <Link className="btn btn-ghost" href="/admin">管理</Link>}
      </div>
    </div>
  )
}