import crypto from 'crypto'

const WINDOW_MS = 5 * 60 * 1000

function currentWindow(): number {
  return Math.floor(Date.now() / WINDOW_MS)
}

function sign(secret: string, email: string, window: number): string {
  return crypto.createHmac('sha256', secret).update(`${email}:${window}`).digest('base64url')
}

export function generateLoginCsrfToken(email: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  const window = currentWindow()
  return `${window}.${sign(secret, email, window)}`
}

export function verifyLoginCsrfToken(token: string, email: string): boolean {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  const dot = token.indexOf('.')
  if (dot === -1) return false
  const windowStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const window = parseInt(windowStr, 10)
  if (isNaN(window)) return false
  const current = currentWindow()
  if (window !== current && window !== current - 1) return false
  const expected = sign(secret, email, window)
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))
  } catch {
    return false
  }
}