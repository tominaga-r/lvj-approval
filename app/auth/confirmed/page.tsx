// app/auth/confirmed/page.tsx
import ConfirmedClient from './ConfirmedClient'

type Props = {
  searchParams: Promise<{ next?: string }>
}

export default async function AuthConfirmedPage({ searchParams }: Props) {
  const resolved = await searchParams
  const n = resolved.next ?? '/'
  const next = n.startsWith('/') ? n : '/'

  return <ConfirmedClient next={next} />
}
