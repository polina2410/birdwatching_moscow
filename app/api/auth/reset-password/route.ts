import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { confirmResetSchema } from '@/lib/validation/auth'
import { BCRYPT_COST } from '@/lib/constants'
import { validateRequest } from '@/lib/api/validate'

const INVALID_LINK = { error: 'Invalid or expired link' }

export async function POST(req: Request) {
  const result = await validateRequest(req, confirmResetSchema)

  if (!result.success) {
    return result.response
  }

  const { token: rawToken, newPassword } = result.data

  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex')

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  })

  const now = new Date()

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt <= now
  ) {
    return NextResponse.json(INVALID_LINK, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: {
      id: resetToken.userId,
      deletedAt: null,
    },
  })

  if (!user) {
    return NextResponse.json(INVALID_LINK, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)

  // Nested write — Prisma runs the password change and the token burn in a
  // single transaction, so a used token can never survive a changed password.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // The forced ADMIN/SUPERADMIN rotation is satisfied by this reset
      passwordResetRequired: false,
      passwordResetTokens: {
        update: {
          where: { id: resetToken.id },
          data: { usedAt: now },
        },
      },
    },
  })

  return NextResponse.json({ ok: true })
}