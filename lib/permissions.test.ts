// lib/permissions.test.ts
import { describe, expect, it } from 'vitest'
import {
  canCancel,
  canCreateRequest,
  canDecide,
  canEditDraft,
  canSubmit,
} from './permissions'

describe('permissions', () => {
  it('canCreateRequest', () => {
    expect(canCreateRequest('REQUESTER')).toBe(true)
    expect(canCreateRequest('ADMIN')).toBe(true)
    expect(canCreateRequest('APPROVER')).toBe(false)
  })

  it('canEditDraft', () => {
    expect(canEditDraft('REQUESTER', true, 'DRAFT')).toBe(true)
    expect(canEditDraft('REQUESTER', false, 'DRAFT')).toBe(false)
    expect(canEditDraft('ADMIN', false, 'DRAFT')).toBe(true)
    expect(canEditDraft('ADMIN', false, 'SUBMITTED')).toBe(false)
  })

  it('submit/cancel/decide rules', () => {
    expect(canSubmit(true, 'DRAFT')).toBe(true)
    expect(canSubmit(true, 'SUBMITTED')).toBe(false)

    expect(canCancel(true, 'DRAFT')).toBe(true)
    expect(canCancel(true, 'SUBMITTED')).toBe(true)
    expect(canCancel(true, 'APPROVED')).toBe(false)

    expect(canDecide('APPROVER', 'SUBMITTED')).toBe(true)
    expect(canDecide('ADMIN', 'SUBMITTED')).toBe(true)
    expect(canDecide('REQUESTER', 'SUBMITTED')).toBe(false)
    expect(canDecide('APPROVER', 'DRAFT')).toBe(false)
  })
})