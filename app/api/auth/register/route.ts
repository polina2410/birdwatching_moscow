import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validation/auth'
import { sendMail } from '@/lib/mail'
import { validateRequest } from '@/lib/api/validate'
import { HTTP_STATUS_CONFLICT, HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@/lib/constants'

export async function POST(req: Request) {
  const result = await validateRequest(req, registerSchema)

  if (!result.success) {
    return result.response
  }

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
  } catch (err) {
    console.error('POST /api/auth/register failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: HTTP_STATUS_INTERNAL_SERVER_ERROR })
  }

  return NextResponse.json({ ok: true })
}