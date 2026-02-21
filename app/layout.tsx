// app/layout.tsx
import '../styles/globals.css'
import { ReactNode } from 'react'
import Header from './components/Header'
import { ToastProvider } from './components/ui/ToastProvider'
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