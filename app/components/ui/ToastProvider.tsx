// app/components/ui/ToastProvider.tsx
'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
  durationMs?: number
}

type ToastContextValue = {
  toast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    const item: Toast = { id, durationMs: 5000, ...t }

    setItems((prev) => [item, ...prev].slice(0, 3))

    const ms = item.durationMs ?? 5000
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id))
    }, ms)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed inset-x-0 bottom-3 z-50 flex flex-col items-center gap-2 px-3 pointer-events-none"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="card pointer-events-auto w-full max-w-md py-2"
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-800">{t.message}</div>

              {t.actionLabel && t.onAction && (
                <button
                  className="text-sm underline text-blue-600"
                  onClick={async () => {
                    await t.onAction?.()
                    setItems((prev) => prev.filter((x) => x.id !== t.id))
                  }}
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
