// app/themes/[theme]/ThemeClient.tsx
'use client'

import { use, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PostForm, PostFormValues } from '@/app/components/PostForm'
import { LogList } from '@/app/components/LogList'
import { LogFilters } from '@/app/components/LogFilters'
import type { LogItem } from '@/types/log'
import { useToast } from '@/app/components/ui/ToastProvider'

interface ThemePageProps {
  // Next.js 15 では Promise 前提
  params: Promise<{ theme: string }>
}

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

export default function ThemeClient({ params }: ThemePageProps) {
  // URL パラメータ → DB 用テーマへ変換
  const { theme: encoded } = use(params)
  const raw = decodeURIComponent(encoded)
  // /theme/null → DB theme = null
  const theme: string | null = raw === 'null' ? null : raw

  const sp = useSearchParams()
  const { toast } = useToast()

  const [sessionReady, setSessionReady] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // フィルタ変化時の競合（古いリクエストの上書き）を防ぐ
  const reqIdRef = useRef(0)

  const filtersKey = useMemo(() => sp.toString(), [sp])

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

  const fetchLogsPage = useCallback(
    async (mode: 'replace' | 'append', nextCursor?: Cursor | null) => {
      const reqId = ++reqIdRef.current

      if (mode === 'replace') setLoading(true)
      else setLoadingMore(true)

      try {
        const p = new URLSearchParams(filtersKey)
        p.set('theme', theme === null ? 'null' : theme)
        p.set('limit', String(PAGE_SIZE))

        if (nextCursor) {
          p.set('cursor_created_at', nextCursor.created_at)
          p.set('cursor_id', nextCursor.id)
        } else {
          p.delete('cursor_created_at')
          p.delete('cursor_id')
        }

        const url = `/api/logs?${p.toString()}`
        const res = await fetch(url)
        const data = (await res.json()) as unknown

        // 競合防止：古いレスポンスは捨てる
        if (reqId !== reqIdRef.current) return

        if (!res.ok) {
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
      } catch (err) {
        if (reqId !== reqIdRef.current) return
        toast({ message: 'ログの取得に失敗しました。' })
        console.error('fetchLogs 失敗:', err)
      } finally {
        if (reqId === reqIdRef.current) {
          if (mode === 'replace') setLoading(false)
          else setLoadingMore(false)
        }
      }
    },
    [filtersKey, theme, toast]
  )

  // セッション準備完了後＆フィルタ変更時：リセットして先頭から再取得
  useEffect(() => {
    if (!sessionReady) return

    setLogs([])
    setCursor(null)
    setHasMore(false)

    void fetchLogsPage('replace', null)
  }, [sessionReady, filtersKey, theme, fetchLogsPage])

  const loadMore = useCallback(() => {
    if (!hasMore || !cursor || loadingMore) return
    void fetchLogsPage('append', cursor)
  }, [cursor, fetchLogsPage, hasMore, loadingMore])

  // 投稿処理
  async function handleSubmit(values: PostFormValues) {
    if (!sessionReady) {
      alert('ログイン準備中です。少し待ってから再度お試しください。')
      return
    }

    const body = {
      content: values.content,
      tags: values.tags,
      theme: theme,
    }

    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      alert('投稿に失敗しました')
      return
    }

    // 追加後は先頭から取り直す（ページング前提）
    await fetchLogsPage('replace', null)
  }

  if (!sessionReady) {
    return <div className="p-4">ログイン中...</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{theme ?? '未分類'} の投稿</h1>

      {/* 検索・フィルタ */}
      <LogFilters />

      <PostForm onSubmit={handleSubmit} />

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          <LogList
            logs={logs}
            onChanged={async () => {
              await fetchLogsPage('replace', null)
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
  )
}
