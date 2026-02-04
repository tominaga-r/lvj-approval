// app/theme/[theme]/page.tsx
import { Suspense } from 'react'
import ThemeClient from './ThemeClient'

type Props = {
  params: Promise<{ theme: string }>
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div className="p-4">読み込み中...</div>}>
      <ThemeClient params={params} />
    </Suspense>
  )
}

