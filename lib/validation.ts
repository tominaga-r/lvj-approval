// lib/validation.ts
import { z } from 'zod'

/**
 * 承認ワークフローアプリ用
 */

// ----------------------
// Auth / Common
// ----------------------

export const passwordSchema = z
  .string()
  .min(8, { message: 'パスワードは8文字以上にしてください' })
  .max(128, { message: 'パスワードが長すぎます' })

export const emailRequiredSchema = z
  .string()
  .trim()
  .min(1, { message: 'メールアドレスを入力してください' })
  .email({ message: 'メールアドレスの形式が正しくありません' })

export const loginSchema = z.object({
  email: emailRequiredSchema,
  password: passwordSchema,
})

export const passwordResetSchema = z.object({
  email: emailRequiredSchema,
})

// ----------------------
// Domain (Admin / Master)
// ----------------------

export const roleSchema = z.enum(['REQUESTER', 'APPROVER', 'ADMIN'])

export const departmentSchema = z
  .string()
  .trim()
  .min(1, { message: '部署は必須です' })
  .max(50, { message: '部署が長すぎます' })

export const requestTypeNameSchema = z
  .string()
  .trim()
  .min(1, { message: '種別名は必須です' })
  .max(50, { message: '種別名が長すぎます' })

export const optionalRequestAmountSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value || value === '') return null

    const normalized = value.replace(/,/g, '')
    const num = Number(normalized)

    if (Number.isNaN(num)) {
      throw new Error('金額が数値ではありません')
    }

    return num
  })

export function parseOptionalRequestAmount(input?: string): number | null {
  return optionalRequestAmountSchema.parse(input)
}

// ----------------------
// Types
// ----------------------

export type LoginInput = z.infer<typeof loginSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type Role = z.infer<typeof roleSchema>