import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { registerSchema } from '@/lib/validation/auth'
import { sendMail } from '@/lib/mail'
import { BCRYPT_COST } from '@/lib/constants'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email, password, name } = parsed.data

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (existing) {
    return NextResponse.json({ error: 'Email is already taken' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  await prisma.user.create({ data: { email, name, passwordHash, role: Role.USER } })
  await sendMail({ to: email, kind: 'welcome', data: { name } })

  return NextResponse.json({ ok: true })
}