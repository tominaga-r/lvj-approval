// app/components/LogList.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import type { LogItem } from '@/types/log'
import { useToast } from './ui/ToastProvider'
import { ConfirmDialog } from './ui/ConfirmDialog'

type Props = {
  logs: LogItem[]
  onChanged?: () => Promise<void> | void

  //ページ側が 非表示フィルタ を渡してくれた時だけバッジを出す
  hiddenThemes?: string[] // 例: ['null', '仕事']
  hiddenTags?: string[] // 例: ['愚痴', '炎上']
}

export function LogList({ logs, onChanged, hiddenThemes, hiddenTags }: Props) {
  const { toast } = useToast()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftTheme, setDraftTheme] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // 削除確認ダイアログ用
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const byId = useMemo(() => {
    const m = new Map<string, LogItem>()
    for (const l of logs) m.set(l.id, l)
    return m
  }, [logs])

  const hiddenThemeSet = useMemo(
    () => new Set((hiddenThemes ?? []).map((t) => t.trim())),
    [hiddenThemes]
  )
  const hiddenTagSet = useMemo(
    () => new Set((hiddenTags ?? []).map((t) => t.trim())),
    [hiddenTags]
  )

  if (!logs || logs.length === 0) {
    return <p className="text-gray-500">投稿はまだありません。</p>
  }

  function openEdit(id: string) {
    const log = byId.get(id)
    if (!log) return
    setEditingId(id)
    setDraftContent(log.content)
    setDraftTags((log.tags ?? []).join(', '))
    setDraftTheme(log.theme ?? '')
  }

  async function saveEdit(id: string) {
    const themeTrimmed = draftTheme.trim()
    const themeValue = themeTrimmed === '' ? null : themeTrimmed

    const tags = draftTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setBusyId(id)
    try {
      const res = await fetch(`/api/logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftContent,
          tags,
          theme: themeValue,
        }),
      })

      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 既存方針：alert 
        alert('更新に失敗: ' + (j.error || JSON.stringify(j)))
        return
      }

      setEditingId(null)
      toast({ message: '保存しました' })
      await onChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  // 非表示（個別）切り替え + Undo トースト
  async function toggleHidden(id: string, nextHidden: boolean) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hidden: nextHidden }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 既存方針：alert
        alert('更新に失敗: ' + (j.error || JSON.stringify(j)))
        return
      }

      await onChanged?.()

      // 非表示にした時だけ Undo（導線）
      if (nextHidden) {
        toast({
          message: '非表示にしました',
          actionLabel: '元に戻す',
          durationMs: 7000,
          onAction: async () => {
            const res2 = await fetch(`/api/logs/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_hidden: false }),
            })
            const j2 = await res2.json().catch(() => ({}))

            // Undoのfetch失敗を拾う
            if (!res2.ok) {
              console.error('undo toggleHidden error:', j2)
              toast({ message: '元に戻せませんでした。' })
              return
            }

            await onChanged?.()
            toast({ message: '表示に戻しました' })
          },
        })
      } else {
        toast({ message: '表示に戻しました' })
      }
    } finally {
      setBusyId(null)
    }
  }

  // 削除確定（ConfirmDialogから呼ぶ）
  async function deleteLogConfirmed(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/logs/${id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 既存方針：alert を維持
        alert('削除に失敗: ' + (j.error || JSON.stringify(j)))
        return
      }

      // 削除後に編集中なら閉じる（任意）
      if (editingId === id) setEditingId(null)

      await onChanged?.()
      toast({ message: '削除しました' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {/* 削除確認 */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="このログを削除しますか？"
        description="削除すると元に戻せません。心配な場合は、まず「非表示」をおすすめします。"
        confirmLabel="削除する"
        cancelLabel="やめる"
        destructive
        onClose={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          const id = deleteTargetId
          setDeleteTargetId(null)
          if (!id) return
          await deleteLogConfirmed(id)
        }}
      />

      <div className="space-y-4">
        {logs.map((log) => {
          const themeLabel = log.theme ?? '未分類'
          const themeSlug = encodeURIComponent(log.theme ?? 'null')
          const isEditing = editingId === log.id
          const isBusy = busyId === log.id

          // 非表示フィルタに該当しているか（propsが渡された時だけ意味を持つ）
          const themeKey = log.theme === null ? 'null' : String(log.theme).trim()
          const isThemeFiltered = hiddenThemes ? hiddenThemeSet.has(themeKey) : false
          const tags: string[] = Array.isArray(log.tags) ? log.tags : []
          const hitTags = hiddenTags
            ? tags.filter((t) => hiddenTagSet.has(String(t).trim()))
            : []
          const isTagFiltered = hiddenTags ? hitTags.length > 0 : false
          const isFilteredByThemeOrTag = isThemeFiltered || isTagFiltered

          return (
            <div key={log.id} className="card">
              <div className="flex justify-between gap-3">
                <div className="text-xs text-gray-500 mb-1">
                  {new Date(log.created_at).toLocaleString('ja-JP')}
                </div>

                <div className="flex gap-2 text-xs">
                  {!isEditing ? (
                    <button
                      onClick={() => openEdit(log.id)}
                      className="underline"
                      disabled={isBusy}
                    >
                      編集
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => saveEdit(log.id)}
                        className="underline"
                        disabled={isBusy}
                      >
                        {isBusy ? '保存中…' : '保存'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="underline"
                        disabled={isBusy}
                      >
                        キャンセル
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => toggleHidden(log.id, !log.is_hidden)}
                    className="underline"
                    disabled={isBusy}
                  >
                    {log.is_hidden ? '表示に戻す' : '非表示'}
                  </button>

                  <button
                    onClick={() => setDeleteTargetId(log.id)}
                    className="text-red-600 underline"
                    disabled={isBusy}
                  >
                    削除
                  </button>
                </div>
              </div>

              {/* 個別非表示バッジ */}
              {log.is_hidden && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block mb-2">
                  非表示（個別）
                </div>
              )}

              {/* 非表示フィルタ該当バッジ（テーマ/タグ） */}
              {isFilteredByThemeOrTag && (
                <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 inline-block mb-2">
                  このログのテーマ/タグは現在「非表示フィルタ」です
                  {isThemeFiltered
                    ? `（テーマ: ${themeKey === 'null' ? '未分類' : themeKey}）`
                    : ''}
                  {isTagFiltered
                    ? `（タグ: ${hitTags.map((t) => `#${t}`).join(' ')}）`
                    : ''}
                </div>
              )}

              {!isEditing ? (
                <div className="prose mb-2">
                  <ReactMarkdown unwrapDisallowed={true}>
                    {log.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="space-y-2 mb-2">
                  <textarea
                    className="w-full p-2 border rounded"
                    rows={4}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    disabled={isBusy}
                  />
                  <input
                    className="w-full p-2 border rounded"
                    value={draftTags}
                    onChange={(e) => setDraftTags(e.target.value)}
                    placeholder="タグ（カンマ区切り）"
                    disabled={isBusy}
                  />
                  <input
                    className="w-full p-2 border rounded"
                    value={draftTheme}
                    onChange={(e) => setDraftTheme(e.target.value)}
                    placeholder="テーマ（空で未分類）"
                    disabled={isBusy}
                  />
                </div>
              )}

              <div className="text-sm">
                <span className="text-gray-600">テーマ：</span>
                <Link href={`/theme/${themeSlug}`} className="text-blue-600 underline">
                  {themeLabel}
                </Link>
              </div>

              {tags.length > 0 && (
                <div className="mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block text-xs bg-gray-200 rounded px-2 py-1 mr-2"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// 'use client'

// import { useMemo, useState } from 'react'
// import Link from 'next/link'
// import ReactMarkdown from 'react-markdown'
// import type { LogItem } from '@/types/log'
// import { useToast } from './ui/ToastProvider'
// import { ConfirmDialog } from './ui/ConfirmDialog'

// type Props = {
//   logs: LogItem[]
//   onChanged?: () => Promise<void> | void

//   // ページ側が 非表示フィルタを渡してくれた時だけバッジを出す
//   hiddenThemes?: string[] // 例: ['null', '仕事']
//   hiddenTags?: string[] // 例: ['愚痴', '炎上']
// }

// export function LogList({ logs, onChanged, hiddenThemes, hiddenTags }: Props) {
//   const { toast } = useToast()

//   const [editingId, setEditingId] = useState<string | null>(null)
//   const [draftContent, setDraftContent] = useState('')
//   const [draftTags, setDraftTags] = useState('')
//   const [draftTheme, setDraftTheme] = useState('')
//   const [busyId, setBusyId] = useState<string | null>(null)

//   // 削除確認ダイアログ用
//   const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

//   const byId = useMemo(() => {
//     const m = new Map<string, LogItem>()
//     for (const l of logs) m.set(l.id, l)
//     return m
//   }, [logs])

//   const hiddenThemeSet = useMemo(
//     () => new Set((hiddenThemes ?? []).map((t) => t.trim())),
//     [hiddenThemes]
//   )
//   const hiddenTagSet = useMemo(
//     () => new Set((hiddenTags ?? []).map((t) => t.trim())),
//     [hiddenTags]
//   )

//   if (!logs || logs.length === 0) {
//     return <p className="text-gray-500">投稿はまだありません。</p>
//   }

//   function openEdit(id: string) {
//     const log = byId.get(id)
//     if (!log) return
//     setEditingId(id)
//     setDraftContent(log.content)
//     setDraftTags((log.tags ?? []).join(', '))
//     setDraftTheme(log.theme ?? '')
//   }

//   async function saveEdit(id: string) {
//     const themeTrimmed = draftTheme.trim()
//     const themeValue = themeTrimmed === '' ? null : themeTrimmed

//     const tags = draftTags
//       .split(',')
//       .map((t) => t.trim())
//       .filter(Boolean)

//     setBusyId(id)
//     try {
//       const res = await fetch(`/api/logs/${id}`, {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           content: draftContent,
//           tags,
//           theme: themeValue,
//         }),
//       })

//       const j = await res.json().catch(() => ({}))
//       if (!res.ok) {
//         alert('更新に失敗: ' + (j.error || JSON.stringify(j)))
//         return
//       }

//       setEditingId(null)
//       await onChanged?.()
//     } finally {
//       setBusyId(null)
//     }
//   }

//   // 非表示（個別）切り替え + Undo トースト
//   async function toggleHidden(id: string, nextHidden: boolean) {
//     setBusyId(id)
//     try {
//       const res = await fetch(`/api/logs/${id}`, {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ is_hidden: nextHidden }),
//       })
//       const j = await res.json().catch(() => ({}))
//       if (!res.ok) {
//         alert('更新に失敗: ' + (j.error || JSON.stringify(j)))
//         return
//       }

//       await onChanged?.()

//       // 非表示にした時だけ Undo（安心導線）
//       if (nextHidden) {
//         toast({
//           message: '非表示にしました',
//           actionLabel: '元に戻す',
//           durationMs: 7000,
//           onAction: async () => {
//             const res2 = await fetch(`/api/logs/${id}`, {
//               method: 'PATCH',
//               headers: { 'Content-Type': 'application/json' },
//               body: JSON.stringify({ is_hidden: false }),
//             })
//             const j2 = await res2.json().catch(() => ({}))

//             // Undoのfetch失敗を拾う
//             if (!res2.ok) {
//               console.error('undo toggleHidden error:', j2)
//               toast({ message: '元に戻せませんでした。' })
//               return
//             }

//             await onChanged?.()
//             toast({ message: '表示に戻しました' })
//           },
//         })
//       } else {
//         // 表示に戻した時も控えめに通知（トーンは既存UIに合わせて軽く）
//         toast({ message: '表示に戻しました' })
//       }
//     } finally {
//       setBusyId(null)
//     }
//   }

//   // 削除確定（ConfirmDialogから呼ぶ）
//   async function deleteLogConfirmed(id: string) {
//     setBusyId(id)
//     try {
//       const res = await fetch(`/api/logs/${id}`, { method: 'DELETE' })
//       const j = await res.json().catch(() => ({}))
//       if (!res.ok) {
//         alert('削除に失敗: ' + (j.error || JSON.stringify(j)))
//         return
//       }

//       // 削除後に編集中なら閉じる
//       if (editingId === id) setEditingId(null)

//       await onChanged?.()
//       toast({ message: '削除しました' })
//     } finally {
//       setBusyId(null)
//     }
//   }

//   return (
//     <>
//       {/* 削除確認*/}
//       <ConfirmDialog
//         open={deleteTargetId !== null}
//         title="このログを削除しますか？"
//         description="削除すると元に戻せません。心配な場合は、まず「非表示」をおすすめします。"
//         confirmLabel="削除する"
//         cancelLabel="やめる"
//         destructive
//         onClose={() => setDeleteTargetId(null)}
//         onConfirm={async () => {
//           const id = deleteTargetId
//           setDeleteTargetId(null)
//           if (!id) return
//           await deleteLogConfirmed(id)
//         }}
//       />

//       <div className="space-y-4">
//         {logs.map((log) => {
//           const themeLabel = log.theme ?? '未分類'
//           const themeSlug = encodeURIComponent(log.theme ?? 'null')
//           const isEditing = editingId === log.id
//           const isBusy = busyId === log.id

//           // 非表示フィルタに該当しているか（propsが渡された時だけ意味を持つ）
//           const themeKey = log.theme === null ? 'null' : String(log.theme).trim()
//           const isThemeFiltered = hiddenThemes ? hiddenThemeSet.has(themeKey) : false
//           const tags: string[] = Array.isArray(log.tags) ? log.tags : []
//           const hitTags = hiddenTags
//             ? tags.filter((t) => hiddenTagSet.has(String(t).trim()))
//             : []
//           const isTagFiltered = hiddenTags ? hitTags.length > 0 : false
//           const isFilteredByThemeOrTag = isThemeFiltered || isTagFiltered

//           return (
//             <div key={log.id} className="card">
//               <div className="flex justify-between gap-3">
//                 <div className="text-xs text-gray-500 mb-1">
//                   {new Date(log.created_at).toLocaleString('ja-JP')}
//                 </div>

//                 <div className="flex gap-2 text-xs">
//                   {!isEditing ? (
//                     <button
//                       onClick={() => openEdit(log.id)}
//                       className="underline"
//                       disabled={isBusy}
//                     >
//                       編集
//                     </button>
//                   ) : (
//                     <>
//                       <button
//                         onClick={() => saveEdit(log.id)}
//                         className="underline"
//                         disabled={isBusy}
//                       >
//                         保存
//                       </button>
//                       <button
//                         onClick={() => setEditingId(null)}
//                         className="underline"
//                         disabled={isBusy}
//                       >
//                         キャンセル
//                       </button>
//                     </>
//                   )}

//                   <button
//                     onClick={() => toggleHidden(log.id, !log.is_hidden)}
//                     className="underline"
//                     disabled={isBusy}
//                   >
//                     {log.is_hidden ? '表示に戻す' : '非表示'}
//                   </button>

//                   <button
//                     onClick={() => setDeleteTargetId(log.id)}
//                     className="text-red-600 underline"
//                     disabled={isBusy}
//                   >
//                     削除
//                   </button>
//                 </div>
//               </div>

//               {/* 個別非表示バッジ */}
//               {log.is_hidden && (
//                 <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block mb-2">
//                   非表示（個別）
//                 </div>
//               )}

//               {/* 非表示フィルタ該当バッジ（テーマ/タグ） */}
//               {isFilteredByThemeOrTag && (
//                 <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 inline-block mb-2">
//                   このログのテーマ/タグは現在「非表示フィルタ」です
//                   {isThemeFiltered
//                     ? `（テーマ: ${themeKey === 'null' ? '未分類' : themeKey}）`
//                     : ''}
//                   {isTagFiltered
//                     ? `（タグ: ${hitTags.map((t) => `#${t}`).join(' ')}）`
//                     : ''}
//                 </div>
//               )}

//               {!isEditing ? (
//                 <div className="prose mb-2">
//                   <ReactMarkdown unwrapDisallowed={true}>
//                     {log.content}
//                   </ReactMarkdown>
//                 </div>
//               ) : (
//                 <div className="space-y-2 mb-2">
//                   <textarea
//                     className="w-full p-2 border rounded"
//                     rows={4}
//                     value={draftContent}
//                     onChange={(e) => setDraftContent(e.target.value)}
//                     disabled={isBusy}
//                   />
//                   <input
//                     className="w-full p-2 border rounded"
//                     value={draftTags}
//                     onChange={(e) => setDraftTags(e.target.value)}
//                     placeholder="タグ（カンマ区切り）"
//                     disabled={isBusy}
//                   />
//                   <input
//                     className="w-full p-2 border rounded"
//                     value={draftTheme}
//                     onChange={(e) => setDraftTheme(e.target.value)}
//                     placeholder="テーマ（空で未分類）"
//                     disabled={isBusy}
//                   />
//                 </div>
//               )}

//               <div className="text-sm">
//                 <span className="text-gray-600">テーマ：</span>
//                 <Link href={`/theme/${themeSlug}`} className="text-blue-600 underline">
//                   {themeLabel}
//                 </Link>
//               </div>

//               {tags.length > 0 && (
//                 <div className="mt-2">
//                   {tags.map((tag) => (
//                     <span
//                       key={tag}
//                       className="inline-block text-xs bg-gray-200 rounded px-2 py-1 mr-2"
//                     >
//                       #{tag}
//                     </span>
//                   ))}
//                 </div>
//               )}
//             </div>
//           )
//         })}
//       </div>
//     </>
//   )
// }
