// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ここに「アクセスさせたくないホスト名」を列挙
const PROD_HOST = 'my-organize-app.vercel.app'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''

  if (host === PROD_HOST) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // それ以外（ランダム文字列の preview ドメインなど）は普通に通す
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}


// // middleware.ts(旧式)
// import { NextResponse } from 'next/server'
// import type { NextRequest } from 'next/server'
// import { createServerClient } from '@supabase/ssr'

// export async function middleware(req: NextRequest) {
//   const res = NextResponse.next()

//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() {
//           // Next.js の Request から全ての Cookie を安全に取得
//           return req.cookies.getAll()
//         },
//         setAll(cookies) {
//           // Supabase からの Cookie 更新を反映
//           cookies.forEach(({ name, value, options }) => {
//             res.cookies.set(name, value, options)
//           })
//         },
//       },
//     }
//   )

//   return res
// }

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
// }

