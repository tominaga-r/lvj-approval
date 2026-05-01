// app/auth/confirmed/page.tsx
import { normalizeInternalPath } from '@/lib/authFlow'
import ConfirmedClient from './ConfirmedClient'

type Props = {
  searchParams: Promise<{
    next?: string
  }>
}

export default async function AuthConfirmedPage({ searchParams }: Props) {
  const resolved = await searchParams
  const next = normalizeInternalPath(resolved.next, '/dashboard')

  return <ConfirmedClient next={next} />
}