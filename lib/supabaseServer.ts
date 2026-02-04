// lib/supabaseServer.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Next.js 15 では cookies() は非同期なので await 必須
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Supabase SSR が期待する形式に変換
        getAll() {
          return cookieStore.getAll().map(c => ({
            name: c.name,
            value: c.value,
          }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options })
          })
        },
      },
    }
  )
}

// 使い方例
// Server Component での使用
// // app/dashboard/page.tsx
// import { createSupabaseServerClient } from '@/lib/supabaseServer'

// export default async function DashboardPage() {
//   const supabase = await createSupabaseServerClient()
//   const { data: user } = await supabase.auth.getUser()

//   return <div>Welcome, {user?.email}</div>
// }
// API Route での使用
// // app/api/get-data/route.ts
// import { createSupabaseServerClient } from '@/lib/supabaseServer'

// export async function GET() {
//   const supabase = await createSupabaseServerClient()
//   const { data } = await supabase.from('my_table').select('*')

//   return new Response(JSON.stringify(data), {
//     headers: { 'Content-Type': 'application/json' },
//   })
// }

// lib/supabaseServer.ts(旧式)
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'

// export const createSupabaseServerClient = () =>
//   createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     { cookies: cookies() } // Next.js 14 の cookies() は型安全
//   )

// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'

// export const createSupabaseServerClient = () => {
//   const cookieStore = cookies()

//   return crea teServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() {
//           return cookieStore.getAll()
//         },
//         setAll(cookiesToSet) {
//           cookiesToSet.forEach(({ name, value, options }) => {
//             cookieStore.set(name, value, options)
//           })
//         },
//       },
//     }
//   )
// }
