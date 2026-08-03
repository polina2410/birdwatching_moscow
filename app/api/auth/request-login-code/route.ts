import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requestLoginCodeSchema } from '@/lib/validation/auth'
import { generateLoginCode, hashLoginCode } from '@/lib/login-code'
import { sendMail } from '@/lib/mail'
import { LOGIN_CODE_TTL_MS } from '@/lib/constants'
import { validateRequest } from '@/lib/api/validate'

// Byte-identical for unknown, privileged, blocked and soft-deleted accounts —
// anything else would turn this endpoint into an email-enumeration oracle.
const SAFE_RESPONSE = {
  ok: true,
  message: 'Если этот email зарегистрирован, мы отправили код.',
}

export async function POST(req: NextRequest) {
  const result = await validateRequest(req, requestLoginCodeSchema)

  if (!result.success) {
    return result.response
  }

  const { email } = result.data

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

  return NextResponse.json(SAFE_RESPONSE)
}
