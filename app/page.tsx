// app/page.tsx
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    await requireUser()
    redirect('/dashboard')
  } catch {
    redirect('/login')
  }
}
