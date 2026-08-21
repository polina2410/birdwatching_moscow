import crypto from 'crypto'
import { LOGIN_CODE_ALPHABET, LOGIN_CODE_LENGTH } from '@/lib/constants'

/**
 * Cryptographically secure one-time login code.
 * `crypto.randomInt` — never `Math.random` — over an ambiguity-free alphabet.
 */
export function generateLoginCode(): string {
  let code = ''
  for (let i = 0; i < LOGIN_CODE_LENGTH; i++) {
    code += LOGIN_CODE_ALPHABET[crypto.randomInt(0, LOGIN_CODE_ALPHABET.length)]
  }
  return code
}

/** Strips whitespace and hyphens, uppercases: ' ab c-d2f ' → 'ABCD2F'. */
export function normalizeLoginCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

/** SHA-256 hex of the normalised code — only this is ever persisted. */
export function hashLoginCode(raw: string): string {
  return crypto.createHash('sha256').update(normalizeLoginCode(raw)).digest('hex')
}
