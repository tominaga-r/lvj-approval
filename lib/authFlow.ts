const DEFAULT_AUTH_REDIRECT_PATH = '/dashboard'

export function normalizeInternalPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
) {
  const raw = value?.trim()
  if (!raw) return fallback

  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//')) return fallback
  if (/[\r\n]/.test(raw)) return fallback

  try {
    const parsed = new URL(raw, 'http://local.invalid')
    if (parsed.origin !== 'http://local.invalid') return fallback

    return `${parsed.pathname}${parsed.search}`
  } catch {
    return fallback
  }
}

export function getBrowserNextPath(fallback = DEFAULT_AUTH_REDIRECT_PATH) {
  if (typeof window === 'undefined') return fallback

  const params = new URLSearchParams(window.location.search)
  return normalizeInternalPath(params.get('next'), fallback)
}

export function buildInternalRedirectUrl(
  reqUrl: string,
  path: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
) {
  const url = new URL(reqUrl)
  const safePath = normalizeInternalPath(path, fallback)

  return new URL(safePath, url.origin)
}