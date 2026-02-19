// app/settings/page.tsx
import { requireProfile } from '@/lib/authz'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { profile } = await requireProfile()

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">設定</h1>
      <SettingsClient profile={profile} />
    </div>
  )
}
