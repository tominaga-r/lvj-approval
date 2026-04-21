// lib/requestGuards.ts
import { NextResponse } from 'next/server'

function getAllowedHosts(req: Request) {
  const hosts = new Set<string>()

  try {
    hosts.add(new URL(req.url).host)
  } catch {}

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)

  for (const candidate of candidates) {
    try {
      hosts.add(new URL(candidate).host)
    } catch {}
  }

  return hosts
}

function matchesAllowedHost(rawUrl: string, req: Request) {
  try {
    const url = new URL(rawUrl)
    return getAllowedHosts(req).has(url.host)
  } catch {
    return false
  }
}

export function isLikelySameSite(req: Request): boolean {
  const secFetchSite = req.headers.get('sec-fetch-site')

  if (secFetchSite) {
    if (
      secFetchSite === 'same-origin' ||
      secFetchSite === 'same-site' ||
      secFetchSite === 'none'
    ) {
      return true
    }
    return false
  }

  const origin = req.headers.get('origin')
  if (origin) {
    return matchesAllowedHost(origin, req)
  }

  const referer = req.headers.get('referer')
  if (referer) {
    return matchesAllowedHost(referer, req)
  }

  return false
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