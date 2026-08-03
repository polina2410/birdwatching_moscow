import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validation/auth'
import { sendMail } from '@/lib/mail'
import { validateRequest } from '@/lib/api/validate'

export async function POST(req: NextRequest) {
  const result = await validateRequest(req, registerSchema)

  if (!result.success) {
    return result.response
  }

  const { email, name } = result.data

  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'Email is already taken' },
      { status: 409 }
    )
  }

  // Passwordless: regular accounts sign in with an emailed one-time code
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: null,
      role: 'USER',
    },
  })

  await sendMail({
    to: email,
    kind: 'welcome',
    data: { name },
  })

  return NextResponse.json({ ok: true })
}