// app/components/LogFilters.tsx
'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Initial = {
  q: string
  tags: string
  from: string
  to: string
}

function normalizeTags(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

export function LogFilters({ fixedTheme }: { fixedTheme?: string | null }) {
  const sp = useSearchParams()

  // URL クエリを 唯一の正とみなし、URLが変わったらフォームごと作り直す
  const key = sp.toString()

  const initial: Initial = useMemo(
    () => ({
      q: sp.get('q') ?? '',
      tags: sp.get('tags') ?? '',
      from: sp.get('from') ?? '',
      to: sp.get('to') ?? '',
    }),
    [sp]
  )

  // fixedTheme をクエリ用に変換（未分類は "null" を送る）
  const fixedThemeParam =
    fixedTheme === undefined ? undefined : fixedTheme === null ? 'null' : fixedTheme

  return (
    <LogFiltersForm
      key={key}
      initial={initial}
      baseQueryString={sp.toString()}
      fixedThemeParam={fixedThemeParam}
    />
  )
}

function LogFiltersForm({
  initial,
  baseQueryString,
  fixedThemeParam,
}: {
  initial: Initial
  baseQueryString: string
  fixedThemeParam: string | undefined
}) {
  const router = useRouter()
  const pathname = usePathname()

  // 初期化は初回マウント時だけ（URL変更時は key で再マウントされる）
  const [q, setQ] = useState(() => initial.q)
  const [tagsText, setTagsText] = useState(() => initial.tags)
  const [from, setFrom] = useState(() => initial.from)
  const [to, setTo] = useState(() => initial.to)

  const tags = useMemo(() => normalizeTags(tagsText), [tagsText])

  function buildParams() {
    const p = new URLSearchParams(baseQueryString)

    const setOrDelete = (k: string, v: string) => {
      const t = v.trim()
      if (t) p.set(k, t)
      else p.delete(k)
    }

    setOrDelete('q', q)

    // tags は正規化して保存
    if (tags.length > 0) p.set('tags', tags.join(','))
    else p.delete('tags')

    setOrDelete('from', from)
    setOrDelete('to', to)

    // テーマ固定があるなら必ず上書きで保持
    if (fixedThemeParam !== undefined) p.set('theme', fixedThemeParam)

    return p
  }

  function apply() {
    const p = buildParams()
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function clear() {
    setQ('')
    setTagsText('')
    setFrom('')
    setTo('')

    const p = new URLSearchParams(baseQueryString)
    p.delete('q')
    p.delete('tags')
    p.delete('from')
    p.delete('to')

    // クリアしてもテーマ固定は残す
    if (fixedThemeParam !== undefined) p.set('theme', fixedThemeParam)

    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="card mb-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <div>
          <label className="block text-sm mb-1">キーワード</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="本文を検索"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">タグ（カンマ区切り）</label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="例: 愚痴, 炎上"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            適用
          </button>
          <button
            type="button"
            onClick={clear}
            className="bg-gray-200 px-4 py-2 rounded"
          >
            クリア
          </button>
        </div>
      </form>
    </div>
  )
}
