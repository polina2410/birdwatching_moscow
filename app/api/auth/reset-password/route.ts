import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { confirmResetSchema } from '@/lib/validation/auth'
import { BCRYPT_COST } from '@/lib/constants'

const INVALID_LINK = { error: 'Invalid or expired link' }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = confirmResetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { token: rawToken, newPassword } = parsed.data
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  const now = new Date()

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt <= now) {
    return NextResponse.json(INVALID_LINK, { status: 400 })
  }

  const user = await prisma.user.findFirst({ where: { id: resetToken.userId, deletedAt: null } })
  if (!user) {
    return NextResponse.json(INVALID_LINK, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: now } }),
  ])

  return NextResponse.json({ ok: true })
}