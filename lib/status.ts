// lib/status.ts

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export function getStatusLabel(status: string) {
  switch (status) {
    case 'DRAFT':
      return '下書き'
    case 'SUBMITTED':
      return '承認待ち'
    case 'RETURNED':
      return '差し戻し'
    case 'APPROVED':
      return '承認済み'
    case 'REJECTED':
      return '却下'
    case 'CANCELLED':
      return '取消済み'
    default:
      return status
  }
}

export function getStatusChipClass(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 border-slate-300'
    case 'SUBMITTED':
      return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'RETURNED':
      return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'REJECTED':
      return 'bg-rose-100 text-rose-800 border-rose-300'
    case 'CANCELLED':
      return 'bg-zinc-100 text-zinc-700 border-zinc-300'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300'
  }
}