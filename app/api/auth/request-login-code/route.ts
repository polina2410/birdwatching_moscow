import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requestLoginCodeSchema } from '@/lib/validation/auth'
import { generateLoginCode, hashLoginCode } from '@/lib/login-code'
import { sendMail } from '@/lib/mail'
import { LOGIN_CODE_TTL_MS } from '@/lib/constants'
import { validateRequest } from '@/lib/api/validate'
import { checkRateLimit } from '@/lib/rateLimit'

// Byte-identical for unknown, privileged, blocked and soft-deleted accounts —
// anything else would turn this endpoint into an email-enumeration oracle.
const SAFE_RESPONSE = { ok: true }

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const rateLimit = await checkRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    )
  }

  const result = await validateRequest(req, requestLoginCodeSchema)
  if (!result.success) {
    return result.response
  }

  const { email } = result.data

  try {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    })

    // Codes are for regular accounts only; staff sign in at /login/password
    if (user && user.role === 'USER' && !user.blockedAt) {
      // One active code per email, mirroring the password-reset invalidation
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
        data: { code },
      })
    }
  } catch (err) {
    // Log but swallow — the anti-enumeration guarantee must hold even on
    // infrastructure failure; a 500 would reveal which emails have live accounts.
    console.error('POST /api/auth/request-login-code failed', err)
  }

  return NextResponse.json(SAFE_RESPONSE)
}
