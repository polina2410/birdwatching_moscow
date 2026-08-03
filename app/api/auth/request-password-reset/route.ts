import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requestResetSchema } from '@/lib/validation/auth'
import { sendMail } from '@/lib/mail'
import { PASSWORD_RESET_TOKEN_TTL_MS } from '@/lib/constants'
import { validateRequest } from '@/lib/api/validate'

const SAFE_RESPONSE = {
  ok: true,
  message: 'If this email is registered, a reset link has been sent.',
}

export async function POST(req: Request) {
  const result = await validateRequest(req, requestResetSchema)

  if (!result.success) {
    return result.response
  }

  const { email } = result.data

  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  })

  // USER accounts have no password to reset — they sign in with an emailed code
  if (user && user.role !== 'USER') {
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    })

    // Raw token goes into the URL; only SHA-256 hash is stored
    const rawToken = crypto.randomBytes(32).toString('base64url')

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex')

    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TOKEN_TTL_MS
    )

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    // APP_URL preferred; NEXT_PUBLIC_APP_URL as legacy fallback.
    // Never use req.headers.get('host') here — a spoofed Host header would
    // redirect the victim's reset token to an attacker-controlled domain.
    const baseUrl =
      process.env.APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000'

    const link = `${baseUrl}/reset-password/${rawToken}`

    await sendMail({
      to: email,
      kind: 'password-reset',
      data: { link },
    })
  }

  return NextResponse.json(SAFE_RESPONSE)
}