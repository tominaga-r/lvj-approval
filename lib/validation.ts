// lib/validation.ts
import { z } from 'zod'

// ----------------------
// Common helpers
// ----------------------

const trimmedRequiredString = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label}は必須です` })
    .max(max, { message: `${label}が長すぎます` })

const trimmedOptionalString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, { message: '入力値が長すぎます' })
    .optional()
    .transform((value) => {
      if (value == null) return null
      return value === '' ? null : value
    })

export const uuidSchema = z.uuid({ message: 'ID形式が不正です' })

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
  .pipe(z.email({ message: 'メールアドレスの形式が正しくありません' }))
  .transform((value) => value.toLowerCase())

export const loginSchema = z.object({
  email: emailRequiredSchema,
  password: passwordSchema,
})

export const passwordResetSchema = z.object({
  email: emailRequiredSchema,
})

export const updateEmailSchema = z.object({
  newEmail: emailRequiredSchema,
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
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new Error('金額が数値ではありません')
    }
    const num = Number(normalized)
    if (!Number.isFinite(num)) {
      throw new Error('金額が不正です')
    }
    if (num < 0) {
      throw new Error('金額にマイナス値は使えません')
    }
    return num
  })

export function parseOptionalRequestAmount(input?: string): number | null {
  return optionalRequestAmountSchema.parse(input)
}

export const requestInputSchema = z.object({
  typeId: z
    .number({ message: '申請種別が不正です' })
    .int({ message: '申請種別が不正です' })
    .positive({ message: '申請種別が不正です' }),
  title: trimmedRequiredString('タイトル', 100),
  description: trimmedRequiredString('内容', 2000),
  amount: z.string().optional(),
  neededBy: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value || value === '') return null
      return value
    }),
})

export const updateUserRoleDepartmentSchema = z.object({
  userId: uuidSchema,
  role: roleSchema,
  department: departmentSchema,
})

export const inviteUserSchema = z.object({
  email: emailRequiredSchema,
  name: trimmedRequiredString('氏名', 100),
  role: roleSchema,
  department: departmentSchema,
})

export const requiredDecisionCommentSchema = z
  .string()
  .trim()
  .min(1, { message: 'コメントは必須です' })
  .max(1000, { message: 'コメントが長すぎます' })

export const optionalDecisionCommentSchema = z
  .string()
  .trim()
  .max(1000, { message: 'コメントが長すぎます' })
  .optional()
  .transform((value) => {
    if (value == null) return null
    return value === '' ? null : value
  })

// ----------------------
// Types
// ----------------------

export type LoginInput = z.infer<typeof loginSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type Role = z.infer<typeof roleSchema>
export type RequestInput = z.infer<typeof requestInputSchema>
export type UpdateUserRoleDepartmentInput = z.infer<typeof updateUserRoleDepartmentSchema>
export type InviteUserInput = z.infer<typeof inviteUserSchema>