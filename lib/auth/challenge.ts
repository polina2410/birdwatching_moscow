import crypto from 'crypto'

export function generateChallengeToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashChallengeToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}