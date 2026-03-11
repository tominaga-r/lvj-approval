// app/email-change-sent/page.tsx
import Link from 'next/link'

type Props = {
  // Next.js 15 では searchParams は Promise で必須扱い
  searchParams: Promise<{ email?: string }>
}

export default async function EmailChangeSentPage({ searchParams }: Props) {
  // Promise を解決してから email を取り出す
  const resolved = await searchParams
  const email = resolved.email ?? ''

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">メールアドレス変更の確認が必要です</h1>

      <p className="mb-3">
        {email
          ? `${email} 宛にメールアドレス変更の確認メールを送信しました。`
          : '新しく登録されたメールアドレス宛に、メールアドレス変更の確認メールを送信しました。'}
      </p>

      <p className="mb-3 text-sm text-gray-700 leading-relaxed">
        メールに記載されたリンクをクリックすると、メールアドレスの変更が完了します。
        完了後は、変更後のメールアドレスとパスワードでログインしてください。
      </p>

      <p className="mb-4 text-xs text-gray-500 leading-relaxed">
        ※ 数分待ってもメールが届かない場合は、迷惑メールフォルダを確認するか、
        入力したメールアドレスに誤りがないか確認してください。
        新しいアドレスを間違えて入力してしまった場合は、
        古いメールアドレスでログインして、設定画面から再度正しいメールアドレスを登録してください。
      </p>

      <a
        href="/login"
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
      >
        ログイン画面へ戻る
      </a>

      <Link href="/login" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">
        ログイン画面へ戻る
      </Link>
    </div>
  )
}
