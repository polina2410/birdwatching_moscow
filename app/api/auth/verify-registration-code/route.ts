import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRegistrationCodeSchema } from '@/lib/validation/auth'
import { hashLoginCode } from '@/lib/login-code'
import { sendMail } from '@/lib/mail'
import { validateRequest } from '@/lib/api/validate'
import { checkRateLimit } from '@/lib/rateLimit'
import { verifyLoginCsrfToken } from '@/lib/auth/csrf'
import {
  LOGIN_CODE_MAX_ATTEMPTS,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_UNAUTHORIZED,
} from '@/lib/constants'

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

  const result = await validateRequest(req, verifyRegistrationCodeSchema)
  if (!result.success) return result.response

  const { email, code, name } = result.data

  const csrfToken = req.headers.get('x-csrf-token')
  if (!csrfToken || !verifyLoginCsrfToken(csrfToken, email)) {
    return NextResponse.json({ error: 'invalid_csrf' }, { status: HTTP_STATUS_FORBIDDEN })
  }

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

  try {
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    })

    if (existing) {
      return NextResponse.json({ error: 'Email is already taken' }, { status: HTTP_STATUS_CONFLICT })
    }

    await prisma.user.create({
      data: { email, name, passwordHash: null, role: 'USER' },
    })

    sendMail({ to: email, kind: 'welcome', data: { name } }).catch((err) =>
      console.error('[register] welcome email failed', err)
    )
  } catch (err) {
    console.error('POST /api/auth/verify-registration-code failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: HTTP_STATUS_INTERNAL_SERVER_ERROR })
  }

  // Code is intentionally left unconsumed — authorizeLoginCode (called via
  // signIn on the client) will consume it when it creates the session.
  return NextResponse.json({ next: 'session' })
}
