import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validation/auth'
import { sendMail } from '@/lib/mail'
import { validateRequest } from '@/lib/api/validate'
import { generateLoginCode, hashLoginCode } from '@/lib/login-code'
import { generateLoginCsrfToken } from '@/lib/auth/csrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { LOGIN_CODE_TTL_MS, HTTP_STATUS_CONFLICT, HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_TOO_MANY_REQUESTS } from '@/lib/constants'

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

  const result = await validateRequest(req, registerSchema)
  if (!result.success) return result.response

  const { email, name } = result.data

  try {
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email is already taken' },
        { status: HTTP_STATUS_CONFLICT }
      )
    }

    await prisma.loginCode.deleteMany({
      where: { email, usedAt: null },
    })

    const code = generateLoginCode()

    await prisma.loginCode.create({
      data: {
        email,
        codeHash: hashLoginCode(code),
        expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
      },
    })

    await sendMail({
      to: email,
      kind: 'login-code',
      data: { code, name },
    })
  } catch (err) {
    console.error('POST /api/auth/register failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: HTTP_STATUS_INTERNAL_SERVER_ERROR })
  }

  let csrfToken: string | undefined
  try {
    csrfToken = generateLoginCsrfToken(email)
  } catch (err) {
    console.error('[auth] csrf token generation failed', err)
  }

  return NextResponse.json({ ok: true, csrfToken })
}
