// lib/requestGuards.ts
import { NextResponse } from 'next/server'

export function isLikelySameSite(req: Request): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  try {
    const reqUrl = new URL(req.url)

    if (origin) {
      const originUrl = new URL(origin)
      if (originUrl.host !== reqUrl.host) return false
    }

    if (referer) {
      const refererUrl = new URL(referer)
      if (refererUrl.host !== reqUrl.host) return false
    }

    return true
  } catch {
    return false
  }
}

export function rejectIfNotLikelySameSite(req: Request) {
  if (!isLikelySameSite(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}

export function rejectIfNotJson(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'invalid content-type' }, { status: 400 })
  }
  return null
}