// app/hidden/page.tsx
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import type { LogItem } from '@/types/log'
import { LogList } from '@/app/components/LogList'
import { useToast } from '@/app/components/ui/ToastProvider'

type HiddenRow = { kind: 'theme' | 'tag'; value: string }

export default function HiddenPage() {
  const { toast } = useToast()

  const [sessionReady, setSessionReady] = useState(false)

  // フィルタ（テーマ/タグ）
  const [rows, setRows] = useState<HiddenRow[]>([])
  const [loadingFilters, setLoadingFilters] = useState(false)
  const [newTag, setNewTag] = useState('')

  // 個別非表示ログ（is_hidden=true）
  const [hiddenLogs, setHiddenLogs] = useState<LogItem[]>([])
  const [loadingHiddenLogs, setLoadingHiddenLogs] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data?.session) await supabase.auth.signInAnonymously()
      } finally {
        setSessionReady(true)
      }
    })()
  }, [])

  const fetchFilters = useCallback(async () => {
    setLoadingFilters(true)
    try {
      const res = await fetch('/api/hidden-filters')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setRows(data as HiddenRow[])
      else setRows([])
    } catch {
      setRows([])
    } finally {
      setLoadingFilters(false)
    }
  }, [])

  const fetchHiddenLogs = useCallback(async () => {
    setLoadingHiddenLogs(true)
    try {
      const res = await fetch('/api/logs?hidden=1')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setHiddenLogs(data as LogItem[])
      else setHiddenLogs([])
    } catch {
      setHiddenLogs([])
    } finally {
      setLoadingHiddenLogs(false)
    }
  }, [])

  useEffect(() => {
    if (sessionReady) {
      fetchFilters()
      fetchHiddenLogs()
    }
  }, [sessionReady, fetchFilters, fetchHiddenLogs])

  const hiddenThemes = useMemo(
    () => rows.filter((r) => r.kind === 'theme').map((r) => r.value),
    [rows]
  )
  const hiddenTags = useMemo(
    () => rows.filter((r) => r.kind === 'tag').map((r) => r.value),
    [rows]
  )

  const labelTheme = (t: string) => (t === 'null' ? '未分類' : t)

  async function removeFilter(kind: 'theme' | 'tag', value: string) {
    const res = await fetch('/api/hidden-filters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, value }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ message: '解除に失敗しました。' })
      console.error('removeFilter error:', j)
      return
    }

    await fetchFilters()
    toast({
      message: '解除しました',
      actionLabel: '元に戻す',
      durationMs: 7000,
      onAction: async () => {
        const res2 = await fetch('/api/hidden-filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, value }),
        })

        if (!res2.ok) {
          const j2 = await res2.json().catch(() => ({}))
          toast({ message: '元に戻せませんでした。' })
          console.error('undo removeFilter error:', j2)
          return
        }

        await fetchFilters()
        toast({ message: '元に戻しました' })
      },
    })
  }

  async function addHiddenTag() {
    const v = newTag.trim()
    if (!v) return

    const res = await fetch('/api/hidden-filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'tag', value: v }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ message: '追加に失敗しました。' })
      console.error('addHiddenTag error:', j)
      return
    }

    setNewTag('')
    await fetchFilters()

    toast({
      message: `#${v} を追加しました`,
      actionLabel: '元に戻す',
      durationMs: 7000,
      onAction: async () => {
        const res2 = await fetch('/api/hidden-filters', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'tag', value: v }),
        })

        if (!res2.ok) {
          const j2 = await res2.json().catch(() => ({}))
          toast({ message: '元に戻せませんでした。' })
          console.error('undo addHiddenTag error:', j2)
          return
        }

        await fetchFilters()
        toast({ message: '元に戻しました' })
      },
    })
  }

  if (!sessionReady) return <div className="p-4">ログイン中...</div>

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">非表示</h1>
        <Link href="/" className="text-blue-600 underline text-sm">
          ホームへ
        </Link>
      </div>

      {/* 混乱防止の説明（文言は維持、ただ “ミュート” を補助的に併記） */}
      <section className="p-3 rounded border bg-gray-50 text-sm leading-relaxed">
        <p className="font-semibold mb-1">ここには2種類の「非表示」があります</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <span className="font-semibold">非表示ログ（個別）</span>：その投稿だけを隠します。
          </li>
          <li>
            <span className="font-semibold">非表示フィルタ（テーマ/タグ）</span>：
            該当テーマ/タグの投稿をまとめて一覧から除外します（＝ミュート）。
          </li>
        </ul>

        <p className="mt-2 text-gray-700">
          ※ 個別ログを「表示に戻す」にしても、ログのテーマ/タグが
          「非表示フィルタ」に該当していると、通常一覧には出ません。
          その場合は <span className="font-semibold">フィルタ解除</span> か
          <span className="font-semibold">ログのテーマ/タグ変更</span> をしてください。
        </p>
      </section>

      {/* 非表示フィルタ */}
      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">非表示フィルタ（テーマ/タグ）</h2>
          <span className="text-xs text-gray-500">
            テーマ {hiddenThemes.length} / タグ {hiddenTags.length}
          </span>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          ここで解除すると、該当テーマ/タグのログが通常一覧に復帰します（ログ自体を削除するわけではありません）。
        </p>

        {loadingFilters ? (
          <p className="text-gray-500 mt-3">読み込み中...</p>
        ) : (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="font-semibold mb-2">非表示テーマ</h3>
              {hiddenThemes.length === 0 ? (
                <p className="text-gray-500">なし</p>
              ) : (
                <ul className="space-y-2">
                  {hiddenThemes.map((t) => (
                    <li
                      key={`theme:${t}`}
                      className="flex justify-between items-center gap-3"
                    >
                      <span>{labelTheme(t)}</span>
                      <button
                        className="text-sm underline"
                        onClick={() => void removeFilter('theme', t)}
                      >
                        表示に戻す
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">非表示タグ</h3>

              <div className="flex gap-2 mb-3">
                <input
                  className="input"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="追加したいタグ（例: 愚痴）"
                />
                <button className="btn btn-primary" onClick={() => void addHiddenTag()}>
                  追加
                </button>
              </div>

              {hiddenTags.length === 0 ? (
                <p className="text-gray-500">なし</p>
              ) : (
                <ul className="space-y-2">
                  {hiddenTags.map((tag) => (
                    <li
                      key={`tag:${tag}`}
                      className="flex justify-between items-center gap-3"
                    >
                      <span>#{tag}</span>
                      <button
                        className="text-sm underline"
                        onClick={() => void removeFilter('tag', tag)}
                      >
                        表示に戻す
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 非表示ログ（個別） */}
      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">非表示ログ（個別）</h2>
          <span className="text-xs text-gray-500">{hiddenLogs.length} 件</span>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          ここに出るのは「個別に非表示にしたログ」です。
          「表示に戻す」で復帰できますが、上の非表示フィルタに該当していると通常一覧には出ません。
        </p>

        {loadingHiddenLogs ? (
          <p className="text-gray-500 mt-3">読み込み中...</p>
        ) : (
          <LogList
            logs={hiddenLogs}
            hiddenThemes={hiddenThemes}
            hiddenTags={hiddenTags}
            onChanged={async () => {
              await fetchHiddenLogs()
              await fetchFilters()
            }}
          />
        )}
      </section>
    </div>
  )
}
