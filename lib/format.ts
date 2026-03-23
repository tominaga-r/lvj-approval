// lib/format.ts
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'

  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, ''))

  if (Number.isNaN(num)) return String(value)

  return new Intl.NumberFormat('ja-JP').format(num)
}