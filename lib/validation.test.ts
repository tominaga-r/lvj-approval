// lib/validation.test.ts
import { describe, expect, it } from 'vitest'
import {
  departmentSchema,
  emailRequiredSchema,
  loginSchema,
  passwordSchema,
  requestTypeNameSchema,
  roleSchema,
} from './validation'

describe('validation', () => {
  it('emailRequiredSchema', () => {
    expect(emailRequiredSchema.safeParse('user@example.com').success).toBe(true)
    expect(emailRequiredSchema.safeParse('').success).toBe(false)
    expect(emailRequiredSchema.safeParse('not-an-email').success).toBe(false)
  })

  it('passwordSchema', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(true)
    expect(passwordSchema.safeParse('1234567').success).toBe(false)
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false)
  })

  it('loginSchema', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '12345678' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: '', password: '12345678' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '123' }).success).toBe(false)
  })

  it('roleSchema', () => {
    expect(roleSchema.safeParse('REQUESTER').success).toBe(true)
    expect(roleSchema.safeParse('APPROVER').success).toBe(true)
    expect(roleSchema.safeParse('ADMIN').success).toBe(true)
    expect(roleSchema.safeParse('HACKER').success).toBe(false)
  })

  it('departmentSchema', () => {
    expect(departmentSchema.safeParse('TOKYO_STORE').success).toBe(true)
    expect(departmentSchema.safeParse(' ').success).toBe(false)
    expect(departmentSchema.safeParse('a'.repeat(51)).success).toBe(false)
  })

  it('requestTypeNameSchema', () => {
    expect(requestTypeNameSchema.safeParse('備品購入申請').success).toBe(true)
    expect(requestTypeNameSchema.safeParse(' ').success).toBe(false)
    expect(requestTypeNameSchema.safeParse('a'.repeat(51)).success).toBe(false)
  })
})