// app/email-check/page.tsx

type Props = {
  searchParams: Promise<{
    email?: string
    context?: 'signup' | 'pseudo_to_real'
  }>
}

export default async function EmailCheckPage({ searchParams }: Props) {
  const resolved = await searchParams
  const email = resolved.email ?? ''
  const context = resolved.context ?? 'signup'

  const title =
    context === 'pseudo_to_real'
      ? 'メールアドレス登録の確認'
      : 'メールアドレス確認のお願い'

  const mainMessage =
    context === 'pseudo_to_real'
      ? '登録されたメールアドレス宛に確認メールを送信しました。'
      : '入力されたメールアドレス宛に確認メールを送信しました。'

  const extraMessage =
    context === 'pseudo_to_real'
      ? 'メール内のリンクをクリックすると、本登録が完了し、今後はメールアドレスとパスワードでログインできるようになります。'
      : 'メール内のリンクをクリックすると、アカウントの作成が完了し、ログインできるようになります。'

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">{title}</h1>

      <p className="mb-3">
        {email
          ? `${email} 宛に確認メールを送信しました。`
          : mainMessage}
      </p>

      <p className="mb-3 text-sm text-gray-700 leading-relaxed">
        メールに記載されたリンクをクリックして手続きを完了してください。
        <br />
        {extraMessage}
      </p>

      <p className="mb-4 text-xs text-gray-500 leading-relaxed">
        ※ 数分待ってもメールが届かない場合は、迷惑メールフォルダを確認するか、
        入力したメールアドレスに誤りがないか確認してください。
      </p>

      <a
        href="/login"
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
      >
        ログイン画面へ
      </a>
    </div>
  )
}
