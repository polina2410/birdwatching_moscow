import { redis } from './redis'

const ANOMALY_WINDOW_SECONDS = 10 * 60
const ANOMALY_EMAIL_THRESHOLD = 5

export async function trackEmailRequestPerIp(ip: string, email: string): Promise<void> {
  if (ip === 'unknown') return
  const key = `anomaly:emails:${ip}`
  await redis.sadd(key, email)
  const [total, ttl] = await Promise.all([redis.scard(key), redis.ttl(key)])
  if (ttl < 0) await redis.expire(key, ANOMALY_WINDOW_SECONDS)
  if (total >= ANOMALY_EMAIL_THRESHOLD) {
    console.warn(
      `[security] anomaly: ip=${ip} requested codes for ${total} distinct emails in ${ANOMALY_WINDOW_SECONDS / 60}min window`
    )
  }
}