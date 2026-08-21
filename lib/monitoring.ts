const ANOMALY_WINDOW_MS = 10 * 60 * 1000
const ANOMALY_EMAIL_THRESHOLD = 5

const store = new Map<string, { emails: Set<string>; expiresAt: number }>()

export function _resetStoreForTesting(): void {
  store.clear()
}

// async so callers can fire-and-forget with .catch() without TypeErrors
export async function trackEmailRequestPerIp(ip: string, email: string): Promise<void> {
  if (ip === 'unknown') return

  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || entry.expiresAt <= now) {
    store.set(ip, { emails: new Set([email]), expiresAt: now + ANOMALY_WINDOW_MS })
    return
  }

  entry.emails.add(email)
  if (entry.emails.size >= ANOMALY_EMAIL_THRESHOLD) {
    console.warn(
      `[security] anomaly: ip=${ip} requested codes for ${entry.emails.size} distinct emails in ${ANOMALY_WINDOW_MS / 60_000}min window`
    )
  }
}
