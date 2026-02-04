// app/HomeClient.tsx
'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PostForm, PostFormValues } from '@/app/components/PostForm'
import { LogList } from '@/app/components/LogList'
import { LogFilters } from '@/app/components/LogFilters'
import type { LogItem } from '@/types/log'
import { useToast } from '@/app/components/ui/ToastProvider'

type Cursor = { created_at: string; id: string }
type PageResponse = { items: LogItem[]; nextCursor: Cursor | null; hasMore: boolean }

const PAGE_SIZE = 30

function isPageResponse(x: any): x is PageResponse {
  return (
    x &&
    typeof x === 'object' &&
    Array.isArray(x.items) &&
    'hasMore' in x &&
    'nextCursor' in x
  )
}

export default function HomeClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const { toast } = useToast()

  const [sessionReady, setSessionReady] = useState(false)

  const [newTheme, setNewTheme] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingThemes, setLoadingThemes] = useState(false)

  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // フィルタ変化時の競合（古いリクエストの上書き）を防ぐ
  const reqIdRef = useRef(0)

  // sp はオブジェクト参照が変わりやすいので “文字列キー” に落とす
  const filtersKey = useMemo(() => sp.toString(), [sp])

  // セッション確認（匿名ログイン含む）
  useEffect(() => {
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()

        if (!sessionData?.session) {
          // セッションが無いときだけ匿名ログイン
          await supabase.auth.signInAnonymously()
        }
        // 既にセッションがある場合は何もしない
      } catch (e) {
        console.error('セッション取得／匿名ログインでエラー:', e)
      } finally {
        setSessionReady(true)
      }
    })()
  }, [])

  // ------- テーマ取得 -------
  const fetchThemes = useCallback(async () => {
    setLoadingThemes(true)

    try {
      const res = await fetch('/api/themes')
      const data = await res.json()

      // API は ['null', '仕事', '日記'] を返す
      if (res.ok && Array.isArray(data)) {
        setThemes(data as string[])
      } else {
        setThemes([])
      }
    } catch {
      setThemes([])
    } finally {
      setLoadingThemes(false)
    }
  }, [])

  // ------- ログ取得（ページング対応） -------
  const fetchLogsPage = useCallback(
    async (mode: 'replace' | 'append', nextCursor?: Cursor | null) => {
      const reqId = ++reqIdRef.current

      // 初回/フィルタ変化時は loadingLogs、追加読み込み時は loadingMore を使う
      if (mode === 'replace') setLoadingLogs(true)
      else setLoadingMore(true)

      try {
        const p = new URLSearchParams(filtersKey)
        p.set('limit', String(PAGE_SIZE))

        if (nextCursor) {
          p.set('cursor_created_at', nextCursor.created_at)
          p.set('cursor_id', nextCursor.id)
        } else {
          p.delete('cursor_created_at')
          p.delete('cursor_id')
        }

        const url = p.toString() ? `/api/logs?${p.toString()}` : '/api/logs'
        const res = await fetch(url)
        const data = (await res.json()) as unknown

        // 競合防止：古いレスポンスは捨てる
        if (reqId !== reqIdRef.current) return

        if (!res.ok) {
          // ここは静かに。必要なら console へ
          toast({ message: 'ログの取得に失敗しました。' })
          console.error('fetchLogs error:', data)
          return
        }

        // 互換：配列が返ってきても壊れないようにする（保険）
        if (Array.isArray(data)) {
          const arr = data as LogItem[]
          if (mode === 'replace') setLogs(arr)
          else setLogs((prev) => [...prev, ...arr])

          setCursor(null)
          setHasMore(false)
          return
        }

        if (isPageResponse(data)) {
          const items = data.items ?? []
          if (mode === 'replace') setLogs(items)
          else setLogs((prev) => [...prev, ...items])

          setCursor(data.nextCursor)
          setHasMore(!!data.hasMore && !!data.nextCursor)
          return
        }

        toast({ message: 'データ形式が想定外です。' })
        console.error('unexpected response shape:', data)
      } catch (e) {
        if (reqId !== reqIdRef.current) return
        toast({ message: 'ログの取得に失敗しました。' })
        console.error('fetchLogs failed:', e)
      } finally {
        // 競合で早期returnしていない場合のみUIを戻す
        if (reqId === reqIdRef.current) {
          if (mode === 'replace') setLoadingLogs(false)
          else setLoadingMore(false)
        }
      }
    },
    [filtersKey, toast]
  )

  // 初回ロード + フィルタ変更時：リセットして先頭を取り直す
  useEffect(() => {
    if (!sessionReady) return

    // フィルタ変化で必ずリセット
    setLogs([])
    setCursor(null)
    setHasMore(false)

    fetchThemes()
    void fetchLogsPage('replace', null)
  }, [sessionReady, filtersKey, fetchThemes, fetchLogsPage])

  const loadMore = useCallback(() => {
    if (!hasMore || !cursor || loadingMore) return
    void fetchLogsPage('append', cursor)
  }, [cursor, fetchLogsPage, hasMore, loadingMore])

  // 新規テーマ作成
  function handleNewTheme() {
    const trimmed = newTheme.trim()
    if (!trimmed) return

    router.push(`/theme/${encodeURIComponent(trimmed)}`)
    setNewTheme('')
  }

  // 投稿処理（未分類 = null）
  async function handleSubmit(values: PostFormValues) {
    const body = {
      content: values.content,
      tags: values.tags,
      theme: null,
    }

    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      alert('保存に失敗しました')
      return
    }

    // 追加後は先頭から取り直す（ページング前提）
    await fetchThemes()
    await fetchLogsPage('replace', null)
  }

  const labelTheme = (t: string) => (t === 'null' ? '未分類' : t)

  // テーマをミュート（= hidden_filters に追加）+ Undo
  async function muteThemeWithUndo(t: string) {
    const res = await fetch('/api/hidden-filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'theme', value: t }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ message: 'ミュートに失敗しました。' })
      console.error('muteTheme error:', j)
      return
    }

    await fetchThemes()
    await fetchLogsPage('replace', null)

    toast({
      message: `「${labelTheme(t)}」をミュートしました`,
      actionLabel: '元に戻す',
      durationMs: 7000,
      onAction: async () => {
        const res2 = await fetch('/api/hidden-filters', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'theme', value: t }),
        })

        if (!res2.ok) {
          const j2 = await res2.json().catch(() => ({}))
          toast({ message: '元に戻せませんでした。' })
          console.error('undo muteTheme error:', j2)
          return
        }

        await fetchThemes()
        await fetchLogsPage('replace', null)
        toast({ message: '元に戻しました' })
      },
    })
  }

  if (!sessionReady) {
    return <div className="p-4">ログイン中...</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ログ・テーマ管理</h1>

      {/* 検索・フィルタ */}
      <LogFilters />

      {/* 新しいテーマ作成 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">新しいテーマを登録</h2>
        <div className="flex gap-2 mt-2">
          <input
            className="border p-2 rounded w-full"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            placeholder="例: 感情ログ"
          />
          <button
            onClick={handleNewTheme}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            作成
          </button>
        </div>
      </div>

      {/* テーマ一覧 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold">テーマ一覧</h2>

        {loadingThemes ? (
          <p>読み込み中...</p>
        ) : (
          <ul className="list-disc list-inside mt-2">
            {themes.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <a
                  href={`/theme/${encodeURIComponent(t)}`}
                  className="text-blue-600 underline"
                >
                  {labelTheme(t)}
                </a>

                {/* confirm/alert をやめて “ミュート + Undo” に統一（上位互換） */}
                <button
                  className="text-xs text-gray-600 underline"
                  onClick={(e) => {
                    e.preventDefault()
                    void muteThemeWithUndo(t)
                  }}
                >
                  ミュート
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 投稿フォーム（未分類） */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">テーマなし投稿</h2>
        <PostForm onSubmit={handleSubmit} />
      </div>

      {/* 投稿一覧 */}
      <div className="space-y-6">
        {loadingLogs ? (
          <p>読み込み中...</p>
        ) : (
          <>
            <LogList
              logs={logs}
              onChanged={async () => {
                // 編集/非表示の変更後は先頭から取り直す
                await fetchLogsPage('replace', null)
                await fetchThemes()
              }}
            />

            {hasMore ? (
              <button
                className="btn btn-secondary w-full"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? '読み込み中…' : 'さらに読み込む'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
