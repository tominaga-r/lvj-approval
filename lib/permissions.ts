// lib/permissions.ts
export type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'
export type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export function canCreateRequest(role: Role) {
  return role === 'REQUESTER' || role === 'ADMIN'
}

export function canEditDraft(role: Role, isOwner: boolean, status: Status) {
  return status === 'DRAFT' && (role === 'ADMIN' || isOwner)
}

export function canSubmit(isOwner: boolean, status: Status) {
  return isOwner && status === 'DRAFT'
}

export function canCancel(isOwner: boolean, status: Status) {
  return isOwner && (status === 'DRAFT' || status === 'SUBMITTED')
}

export function canDecide(role: Role, status: Status) {
  return (role === 'APPROVER' || role === 'ADMIN') && status === 'SUBMITTED'
}