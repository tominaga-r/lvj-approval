// app/components/ui/ConfirmDialog.tsx
'use client'

import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '実行',
  cancelLabel = 'キャンセル',
  destructive = false,
  onConfirm,
  onClose,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return

    // 誤操作防止：開いたらキャンセルへフォーカス
    cancelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
      onMouseDown={onClose}
    >
      <div
        className="card w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>

        {description && (
          <p className="mt-2 text-sm text-gray-700 leading-relaxed">
            {description}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3 text-sm">
          <button ref={cancelRef} className="underline text-gray-700" onClick={onClose}>
            {cancelLabel}
          </button>

          <button
            className={`underline ${
              destructive ? 'text-red-600' : 'text-blue-600'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
