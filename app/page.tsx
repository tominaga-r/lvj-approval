// app/page.tsx
import { Suspense } from 'react'
import HomeClient from './HomeClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">読み込み中...</div>}>
      <HomeClient />
    </Suspense>
  )
}
