// app/approvals/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export default async function ApprovalsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  // SUBMITTEDのみ（承認待ち）
  const { data: rows, error } = await supabase
    .from('requests')
    .select('id, title, status, created_at, requester_id')
    .eq('status', 'SUBMITTED')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-6 text-red-600">承認待ち取得エラー: {error.message}</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">承認待ち</h1>

      <div className="space-y-2">
        {rows?.map(r => (
          <Link key={r.id} href={`/requests/${r.id}`} className="block card hover:bg-gray-50">
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-gray-500">{r.status} / {new Date(r.created_at).toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}