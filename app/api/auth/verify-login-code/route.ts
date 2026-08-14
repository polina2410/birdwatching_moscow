import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyLoginCodeSchema } from '@/lib/validation/auth'
import { hashLoginCode } from '@/lib/login-code'
import { generateChallengeToken, hashChallengeToken } from '@/lib/auth/challenge'
import { LOGIN_CODE_MAX_ATTEMPTS, ADMIN_CHALLENGE_TTL_MS, HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_TOO_MANY_REQUESTS } from '@/lib/constants'
import { validateRequest } from '@/lib/api/validate'
import { checkRateLimit } from '@/lib/rateLimit'
import { verifyLoginCsrfToken } from '@/lib/auth/csrf'

const sessionResponse = () => NextResponse.json({ next: 'session' })

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const rateLimit = await checkRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: HTTP_STATUS_TOO_MANY_REQUESTS, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    )
  }

  const result = await validateRequest(req, verifyLoginCodeSchema)
  if (!result.success) return result.response

  const { email, code } = result.data

  const csrfToken = req.headers.get('x-csrf-token')
  if (!csrfToken || !verifyLoginCsrfToken(csrfToken, email)) {
    return NextResponse.json({ error: 'invalid_csrf' }, { status: HTTP_STATUS_FORBIDDEN })
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })

  // USER, unknown, or blocked admin: defer to signIn('login-code') for proper handling.
  // Returning { next:'session' } for blocked admin intentionally avoids role disclosure.
  if (!user || user.role === 'USER' || user.blockedAt) return sessionResponse()

  // ADMIN/SUPERADMIN: verify OTP here before issuing a challenge token.
  const now = new Date()
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

  if (!match) {
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
    return NextResponse.json({ error: 'invalid_code' }, { status: HTTP_STATUS_UNAUTHORIZED })
  }

  await prisma.loginCode.update({
    where: { id: match.id },
    data: { usedAt: now },
  })

  const rawToken = generateChallengeToken()
  await prisma.adminLoginChallenge.create({
    data: {
      email,
      tokenHash: hashChallengeToken(rawToken),
      expiresAt: new Date(Date.now() + ADMIN_CHALLENGE_TTL_MS),
    },
  })

  const next = user.passwordHash ? 'password' : 'set-password'
  return NextResponse.json({ next, challengeToken: rawToken })
}