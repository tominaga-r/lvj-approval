// types/log.ts

/**
 * 保存される log のレコードを表す型
 */
export interface LogItem {
  id: string
  user_id: string
  content: string
  tags: string[]
  theme: string | null
  created_at: string
  is_hidden: boolean
}

/**
 * API の insert 用型
 */
export interface LogInsert {
  content: string
  tags: string[]
  theme: string | null
}