const WINDOW_MS = 60_000
const MAX_REQUESTS = 2

const store = new Map<string, { count: number; expiresAt: number }>()

export function _resetStoreForTesting(): void {
  store.clear()
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.expiresAt - now) / 1000) }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}
