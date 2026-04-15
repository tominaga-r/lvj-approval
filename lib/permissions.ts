// lib/permissions.ts
export type Role = 'REQUESTER' | 'APPROVER' | 'ADMIN'
export type Status =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export function canCreateRequest(role: Role) {
  return role === 'REQUESTER' || role === 'ADMIN'
}

export function canEditDraft(isOwner: boolean, status: Status) {
  return isOwner && (status === 'DRAFT' || status === 'RETURNED')
}

export function canSubmit(isOwner: boolean, status: Status) {
  return isOwner && (status === 'DRAFT' || status === 'RETURNED')
}

export function canCancel(isOwner: boolean, status: Status) {
  return isOwner && (status === 'DRAFT' || status === 'RETURNED' || status === 'SUBMITTED')
}

export function canDecide(role: Role, status: Status) {
  return (role === 'APPROVER' || role === 'ADMIN') && status === 'SUBMITTED'
}

export function canReturn(role: Role, status: Status) {
  return (role === 'APPROVER' || role === 'ADMIN') && status === 'SUBMITTED'
}