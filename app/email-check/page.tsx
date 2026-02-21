// app/email-check/page.tsx
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: {
    email?: string
  }
}

export default function EmailCheckPage({ searchParams }: Props) {
  const email = searchParams?.email ?? ''

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">メール確認のお願い</h1>

      <p className="mb-3">
        {email ? `${email} 宛に確認メールを送信しました。` : '確認メールを送信しました。'}
      </p>

      <p className="mb-3 text-sm text-gray-700 leading-relaxed">
        メールに記載されたリンクをクリックして手続きを完了してください。
      </p>

      <p className="mb-4 text-xs text-gray-500 leading-relaxed">
        ※ 数分待ってもメールが届かない場合は、迷惑メールフォルダを確認するか、
        入力したメールアドレスに誤りがないか確認してください。
      </p>

      <Link href="/login" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">
        ログイン画面へ
      </Link>
    </div>
  )
}