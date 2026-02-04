// app/layout.tsx
import "../styles/globals.css"
import { ReactNode } from "react"
import { Header } from "./components/Header"
import { ToastProvider } from "./components/ui/ToastProvider"
import type { Metadata } from "next"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900">
        <ToastProvider>
          <Header />
          <main className="pt-20">{children}</main>
        </ToastProvider>
      </body>
    </html>
  )
}




// // app/layout.tsx
// import '/styles/globals.css'
// import Link from 'next/link'
// import { createSupabaseServerClient } from '@/lib/supabaseServer'

// export const metadata = {
//   title: '感情ログアプリ',
//   description: '匿名でも使える創作記録・感情整理・テーマ管理アプリ',
// }

// export default async function RootLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   const supabase = createSupabaseServerClient()
//   const {
//     data: { user },
//   } = await supabase.auth.getUser()

//   return (
//     <html lang="ja">
//       <body>
//         <header className="sticky top-0 z-10">
//           <nav className="flex justify-between items-center px-6 py-3">
//             <Link href="/" className="text-lg font-semibold text-blue-600">
//               創作ログ
//             </Link>
//             <div className="flex gap-4 text-sm">
//               {user ? (
//                 <>
//                   <span className="text-gray-600">
//                     {user.user_metadata?.username || user.email || 'ユーザー'} さん
//                   </span>
//                   <Link href="/settings" className="text-blue-600 hover:underline">
//                     設定
//                   </Link>
//                   <form action="/logout" method="post">
//                     <button className="text-red-600 hover:underline">ログアウト</button>
//                   </form>
//                 </>
//               ) : (
//                 <Link href="/login" className="text-blue-600 hover:underline">
//                   ログイン / 登録
//                 </Link>
//               )}
//             </div>
//           </nav>
//         </header>
//         <main>{children}</main>
//       </body>
//     </html>
//   )
// }