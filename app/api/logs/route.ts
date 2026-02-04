// app/api/logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { LogItem, LogInsert } from '@/types/log'
import { logInsertSchema, tagSchema } from '@/lib/validation'
import { z } from 'zod'

// ===== 検索クエリのスキーマ =====
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  tags: z.string().trim().min(1).max(500).optional(), // CSV
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

// ===== ページングクエリ =====
const limitSchema = z.coerce.number().int().min(1).max(50).default(30)

const pagingQuerySchema = z
  .object({
    limit: limitSchema.optional(),
    cursor_created_at: z.string().optional(),
    cursor_id: z.uuid().optional(),
  })
  .superRefine((v, ctx) => {
    const hasCreated = !!v.cursor_created_at
    const hasId = !!v.cursor_id
    if (hasCreated !== hasId) {
        ctx.addIssue({
          code: 'custom',
          message: 'cursor_created_at と cursor_id はセットで指定してください',
        })
      return
    }
    if (v.cursor_created_at) {
      const t = Date.parse(v.cursor_created_at)
      if (Number.isNaN(t)) {
        ctx.addIssue({
          code: 'custom',
          message: 'cursor_created_at が不正です',
        })
      }
    }
  })

type Cursor = { created_at: string; id: string }
type PageResponse = { items: LogItem[]; nextCursor: Cursor | null; hasMore: boolean }

function toTokyoStartISO(yyyy_mm_dd: string) {
  return new Date(`${yyyy_mm_dd}T00:00:00+09:00`).toISOString()
}
function toTokyoEndExclusiveISO(yyyy_mm_dd: string) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00+09:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

function parseTagsCsv(tagsCsv?: string): string[] {
  if (!tagsCsv) return []
  const arr = tagsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // validation.ts の tagSchema を使って安全に（最大20）
  const parsed = z.array(tagSchema).max(20).safeParse(arr)
  return parsed.success ? parsed.data : []
}

function hasAnyHiddenTag(log: any, hiddenTags: Set<string>): boolean {
  if (hiddenTags.size === 0) return false
  const tgs: string[] = Array.isArray(log.tags) ? log.tags : []
  return tgs.some((t) => hiddenTags.has(t))
}

// GET: ログ一覧（テーマ／タグでフィルタ + 検索）
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(req.url)

  const themeParamRaw = url.searchParams.get('theme') // null = パラメータなし（全テーマ）
  const hiddenParam = url.searchParams.get('hidden') // 1なら is_hidden=true だけ返す

  // 検索系
  const searchParsed = searchQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    tags: url.searchParams.get('tags') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  })
  if (!searchParsed.success) {
    const details = z.flattenError(searchParsed.error)
    return NextResponse.json({ error: 'invalid_query', details }, { status: 400 })
  }
  const { q, tags, from, to } = searchParsed.data
  const tagList = parseTagsCsv(tags)

  // ページング系（指定があればページングモード）
  const pagingEnabled =
    url.searchParams.has('limit') ||
    url.searchParams.has('cursor_created_at') ||
    url.searchParams.has('cursor_id')

  const pagingParsed = pagingQuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    cursor_created_at: url.searchParams.get('cursor_created_at') ?? undefined,
    cursor_id: url.searchParams.get('cursor_id') ?? undefined,
  })
  if (!pagingParsed.success) {
    const details = z.flattenError(pagingParsed.error)
    return NextResponse.json({ error: 'invalid_paging', details }, { status: 400 })
  }

  const limit = (pagingParsed.data.limit ?? 30)
  const cursorCreatedAt = pagingParsed.data.cursor_created_at
  const cursorId = pagingParsed.data.cursor_id

  // --- 認証は getUser で（警告対応） ---
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const wantHiddenLogs = hiddenParam === '1' || hiddenParam === 'true'

  // --- hidden_filters 取得（hidden=1 の時は無視） ---
  let hiddenThemes = new Set<string>()
  let hiddenTags = new Set<string>()

  if (!wantHiddenLogs) {
    const { data: filters, error: fErr } = await supabase
      .from('hidden_filters')
      .select('kind, value')
      .eq('user_id', user.id)

    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

    hiddenThemes = new Set(
      (filters ?? []).filter((r) => r.kind === 'theme').map((r) => r.value)
    )
    hiddenTags = new Set(
      (filters ?? []).filter((r) => r.kind === 'tag').map((r) => r.value)
    )
  }

  // theme フィルタ入力（攻撃/暴走防止の軽いガード）
  const themeParam =
    themeParamRaw === null ? null : (themeParamRaw ?? '').trim().slice(0, 80)

  // ===== クエリ組み立て関数（カーソル付き） =====
  const buildQuery = (cursor?: Cursor | null) => {
    let query = supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_hidden', wantHiddenLogs)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) as any

    // theme フィルタ（URL指定）
    if (themeParam === null) {
      // 全テーマ
    } else if (themeParam === 'null' || themeParam === '') {
      query = query.is('theme', null)
    } else {
      query = query.eq('theme', themeParam)
    }

    // hidden theme 除外は DB で（ページングでも一貫）
    if (!wantHiddenLogs && hiddenThemes.size > 0) {
      // 'null' は theme IS NULL を除外
      if (hiddenThemes.has('null')) {
        query = query.not('theme', 'is', null)
      }
      const nonNullHidden = Array.from(hiddenThemes).filter((t) => t !== 'null')
      if (nonNullHidden.length > 0) {
        // PostgREST の in() 文字列にする（安全にJSON stringify）
        const inList = `(${nonNullHidden.map((t) => JSON.stringify(t)).join(',')})`
        query = query.not('theme', 'in', inList)
      }
    }

    // タグ（AND: 全部含む）
    if (tagList.length > 0) {
      query = query.contains('tags', tagList)
    }

    // キーワード（部分一致）
    if (q) {
      query = query.ilike('content', `%${q}%`)
    }

    // 日付（JST基準のfrom/to）
    if (from) query = query.gte('created_at', toTokyoStartISO(from))
    if (to) query = query.lt('created_at', toTokyoEndExclusiveISO(to))

    // カーソル（created_at desc, id desc の次へ）
    if (cursor?.created_at && cursor?.id) {
      // created_at が同じ場合もあるので、(created_at < t) OR (created_at = t AND id < id)
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      )
    }

    return query
  }

  // ===== 非ページング（後方互換） =====
  if (!pagingEnabled) {
    const { data, error } = await buildQuery(null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // hidden=1 の時は hidden_filters を無視（従来通り）
    if (wantHiddenLogs) {
      return NextResponse.json((data ?? []) as LogItem[])
    }

    // hidden tag 除外（従来：JS側）※テーマはDBで除外済み
    const filtered = (data ?? []).filter((log: any) => !hasAnyHiddenTag(log, hiddenTags))
    return NextResponse.json(filtered as LogItem[])
  }

  // ===== ページングモード =====
  let scanCursor: Cursor | null =
    cursorCreatedAt && cursorId ? { created_at: cursorCreatedAt, id: cursorId } : null

  const items: LogItem[] = []
  let hasMore = false
  let nextCursor: Cursor | null = null

  // hidden tag 除外があると「1回の取得でlimit件埋まらない」ので、少し多めにスキャンする
  const maxScans = 5
  const batchSize = Math.min(100, Math.max(limit * 3, limit))

  for (let i = 0; i < maxScans && items.length < limit; i++) {
    const qy = buildQuery(scanCursor).range(0, batchSize - 1)
    const { data, error } = await qy
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as any[]
    if (rows.length === 0) {
      // もう無い
      hasMore = false
      nextCursor = null
      break
    }

    // このバッチを最後までスキャンしたら次のカーソルは最後の行
    const last = rows[rows.length - 1]
    scanCursor = { created_at: last.created_at, id: last.id }

    // 次があるか（raw的に）
    const rawHasMore = rows.length === batchSize

    // hidden=1 の時は hidden_filters を無視。通常時は hiddenTags を除外。
    for (const r of rows) {
      if (items.length >= limit) break
      if (!wantHiddenLogs && hasAnyHiddenTag(r, hiddenTags)) continue
      items.push(r as LogItem)
    }

    if (items.length >= limit) {
      // まだrawが残ってそうなら hasMore true
      hasMore = rawHasMore
      nextCursor = rawHasMore ? scanCursor : null
      break
    }

    if (!rawHasMore) {
      // rawが尽きた
      hasMore = false
      nextCursor = null
      break
    }

    // rawHasMore で items が足りない場合、次のバッチを継続（scanCursor で続きを取る）
    hasMore = true
    nextCursor = scanCursor
  }

  const resp: PageResponse = { items, nextCursor, hasMore }
  return NextResponse.json(resp)
}

// POST: ログ作成
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const json = await req.json().catch(() => null)
  const parsed = logInsertSchema.safeParse(json)

  if (!parsed.success) {
    const details = z.flattenError(parsed.error)
    return NextResponse.json({ error: 'invalid_body', details }, { status: 400 })
  }

  const insertData: LogInsert = {
    content: parsed.data.content,
    tags: parsed.data.tags ?? [],
    theme: parsed.data.theme ?? null,
  }

  const { data, error } = await supabase
    .from('logs')
    .insert([insertData])
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as LogItem, { status: 201 })
}
