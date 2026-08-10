import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { loginSchema, verifyLoginCodeSchema, adminTwoFactorSchema } from '@/lib/validation/auth'
import { hashLoginCode } from '@/lib/login-code'
import { hashChallengeToken } from '@/lib/auth/challenge'
import { LOGIN_CODE_MAX_ATTEMPTS } from '@/lib/constants'
import { AccountBlockedError, PasswordResetRequiredError } from '@/lib/auth/errors'
import type { AuthorizedUser } from '@/types/auth'

interface LoginCodeRow {
  id: string
  usedAt: Date | null
  expiresAt: Date
  attempts: number
}

/**
 * Defence in depth: the same conditions are already in the SQL where-clause,
 * re-checked here so a widened query can never authenticate a dead code.
 */
function isUsable(row: LoginCodeRow | null, now: Date): row is LoginCodeRow {
  return (
    row !== null &&
    row.usedAt === null &&
    row.expiresAt > now &&
    row.attempts < LOGIN_CODE_MAX_ATTEMPTS
  )
}

/**
 * OTP sign-in for USER accounts. One message for every failure mode — telling
 * wrong from expired from used would leak whether an email has a live code.
 */
export async function authorizeLoginCode(
  credentials: unknown
): Promise<AuthorizedUser | null> {
  const parsed = verifyLoginCodeSchema.safeParse(credentials)
  if (!parsed.success) return null

  const { email, code } = parsed.data

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (!user || user.role !== 'USER') return null
  if (user.blockedAt) throw new AccountBlockedError()

  const now = new Date()

  // email AND codeHash together — a code issued for one account must never
  // authenticate another, and codeHash is not unique.
  const match = await prisma.loginCode.findFirst({
    where: {
      email,
      codeHash: hashLoginCode(code),
      usedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: LOGIN_CODE_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!isUsable(match, now)) {
    // Guessing burns the attempt budget of the live code for this email
    const active = await prisma.loginCode.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    })
    if (active) {
      await prisma.loginCode.update({
        where: { id: active.id },
        data: { attempts: { increment: 1 } },
      })
    }
    return null
  }

  await prisma.loginCode.update({
    where: { id: match.id },
    data: { usedAt: new Date() },
  })

  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

/**
 * Second factor for ADMIN/SUPERADMIN: verifies the short-lived challenge token
 * issued by POST /api/auth/verify-login-code, then checks the password.
 * Status checks run before bcrypt to prevent oracle attacks.
 */
export async function authorizeAdminTwoFactor(
  credentials: unknown
): Promise<AuthorizedUser | null> {
  const parsed = adminTwoFactorSchema.safeParse(credentials)
  if (!parsed.success) return null

  const { email, challengeToken, password } = parsed.data

  const now = new Date()
  const challenge = await prisma.adminLoginChallenge.findFirst({
    where: {
      email,
      tokenHash: hashChallengeToken(challengeToken),
      usedAt: null,
      expiresAt: { gt: now },
    },
  })
  if (!challenge) return null

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (!user || !user.passwordHash) return null

  if (user.blockedAt) throw new AccountBlockedError()
  if (user.passwordResetRequired) throw new PasswordResetRequiredError()

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) return null

  await prisma.adminLoginChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: now },
  })

  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

/** Password sign-in — ADMIN/SUPERADMIN only, since USER rows carry no hash. */
export async function authorizeCredentials(
  credentials: unknown
): Promise<AuthorizedUser | null> {
  const parsed = loginSchema.safeParse(credentials)
  if (!parsed.success) return null

  const { email, password } = parsed.data

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  // No hash — a passwordless USER can never satisfy the password path
  if (!user || !user.passwordHash) return null

  // Status checks before bcrypt: checking after would reveal whether a guessed
  // password is correct by returning a distinct error code on correct-but-blocked.
  if (user.blockedAt) throw new AccountBlockedError()
  if (user.passwordResetRequired) throw new PasswordResetRequiredError()

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) return null

  return { id: user.id, email: user.email, name: user.name, role: user.role }
}
