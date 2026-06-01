import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requestResetSchema } from '@/lib/validation/auth'
import { sendMail } from '@/lib/mail'
import { PASSWORD_RESET_TOKEN_TTL_MS } from '@/lib/constants'

const SAFE_RESPONSE = {
  ok: true,
  message: 'If this email is registered, a reset link has been sent.',
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = requestResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email } = parsed.data
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })

  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })

    // NOTE: raw token (32 URL-safe bytes) goes in the link; only SHA-256 hash is stored
    const rawToken = crypto.randomBytes(32).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)

    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = req.headers.get('host') ?? 'localhost:3000'
    const link = `${protocol}://${host}/reset-password/${rawToken}`

    await sendMail({ to: email, kind: 'password-reset', data: { link } })
  }

  return NextResponse.json(SAFE_RESPONSE)
}