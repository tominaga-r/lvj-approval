// lib/validation.ts
import { z } from 'zod'

/**
 * 共通スキーマ
 */

// UUID（必須）
export const uuidSchema = z.uuid({
  error: 'UUIDの形式が不正です',
})

// UUID（null / undefined 許可）
export const nullableUuidSchema = uuidSchema.nullish()

// ユーザー名
export const usernameSchema = z
  .string()
  .trim()
  .min(3, { error: 'ユーザー名は3文字以上です' })
  .max(32, { error: 'ユーザー名は32文字以内です' })
  .regex(/^[a-zA-Z0-9_ぁ-んァ-ヶ一-龠ー]+$/, {
    error: 'ユーザー名に使えない文字が含まれています',
  })

// パスワード（認証系全体で共通）
export const passwordSchema = z
  .string()
  .min(6, { error: 'パスワードは6文字以上です' })
  .max(128, { error: 'パスワードが長すぎます' })

// email：必須版
const requiredEmailBase = z
  .string()
  .trim()
  .min(1, { error: 'メールアドレスを入力してください' })

const emailFormatSchema = z.email({
  error: 'メールアドレスの形式が正しくありません',
})

export const emailRequiredSchema = requiredEmailBase.pipe(emailFormatSchema)

// email：任意（null / undefined OK）
export const emailOptionalSchema = requiredEmailBase
  .pipe(emailFormatSchema)
  .nullish()

// theme（日本語もOK / 「/」とnull,制御文字は禁止）
export const themeSchema = z
  .string()
  .trim()
  .min(1, { error: 'テーマは1文字以上です' })
  .max(50, { error: 'テーマが長すぎます' })
  .regex(/^[^/\u0000-\u001F\u007F]+$/, {
    error: 'テーマに使えない文字が含まれています（/ や制御文字は不可）',
  })
  .refine((v) => v !== 'null', {
    message: '「null」は予約語のためテーマ名に使えません',
  })
  .nullish()

// タグ
export const tagSchema = z
  .string()
  .trim()
  .min(1, { error: 'タグが空です' })
  .max(32, { error: 'タグが長すぎます' })

export const tagsSchema = z
  .array(tagSchema)
  .max(20, { error: 'タグは20個までです' })
  .optional()
  .default([])

/**
 * API / フォームごとのスキーマ
 */

// ユーザー登録（/api/auth/register & 登録フォーム）
export const registerSchema = z.object({
  anon_user_id: nullableUuidSchema, // 匿名ユーザーID（なくてもOK）
  username: usernameSchema,
  password: passwordSchema,
  // メールは任意。指定があれば本物のメールとして使う
  email: emailOptionalSchema,
})

// ログイン（/login ページで使う想定）
export const loginSchema = z.object({
  email: emailRequiredSchema,
  password: passwordSchema,
})

// ログ作成（/api/logs POST & エディタフォーム）
export const logInsertSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: '内容は必須です' })
    .max(9000, { error: '内容が長すぎます（9000文字まで）' }),
  tags: tagsSchema,
  theme: themeSchema,
})

// username 更新（/api/auth/update-username & 設定画面）
export const updateUsernameSchema = z.object({
  username: usernameSchema,
})

// パスワードリセット（/api/auth/reset-password & フォーム）
export const passwordResetSchema = z.object({
  email: emailRequiredSchema,
})


// 編集
export const tagsUpdateSchema = z
  .array(tagSchema)
  .max(20, { error: 'タグは20個までです' })
  .optional()

export const logUpdateSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, { error: '内容は必須です' })
      .max(9000, { error: '内容が長すぎます（9000文字まで）' })
      .optional(),
    tags: tagsUpdateSchema,
    theme: themeSchema.optional(), // null も許可
    is_hidden: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: '更新内容がありません',
  })

/**
 * 型エクスポート（フォーム・API両方で使える）
 */

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type LogInsertInput = z.infer<typeof logInsertSchema>
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type LogUpdateInput = z.infer<typeof logUpdateSchema>

