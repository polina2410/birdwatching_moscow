import { redis } from './redis'

const WINDOW = 60
const MAX_REQUESTS = 2

export async function checkRateLimit(key: string): Promise<{
  allowed: boolean
  retryAfterSeconds: number
}> {
  const redisKey = `rate_limit:${key}`

  const current = await redis.incr(redisKey)

  // Set the expiry only on the first request so the window is fixed from that
  // point — not sliding. Calling expire on every request (including blocked ones)
  // would let a retrying client extend the window indefinitely.
  if (current === 1) {
    await redis.expire(redisKey, WINDOW)
  }

  if (current > MAX_REQUESTS) {
    const ttl = await redis.ttl(redisKey)
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : WINDOW,
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}
