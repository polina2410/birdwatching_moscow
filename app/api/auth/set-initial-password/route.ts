import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { setInitialPasswordSchema } from '@/lib/validation/auth'
import { generateChallengeToken, hashChallengeToken } from '@/lib/auth/challenge'
import { BCRYPT_COST, ADMIN_CHALLENGE_TTL_MS } from '@/lib/constants'
import { validateRequest } from '@/lib/api/validate'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: Request) {
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

  const result = await validateRequest(req, setInitialPasswordSchema)
  if (!result.success) return result.response

  const { email, challengeToken, password } = result.data

  const now = new Date()
  const challenge = await prisma.adminLoginChallenge.findFirst({
    where: {
      email,
      tokenHash: hashChallengeToken(challengeToken),
      usedAt: null,
      expiresAt: { gt: now },
    },
  })
  if (!challenge) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  })
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') || user.passwordHash !== null) {
    return NextResponse.json({ error: 'not_eligible' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  await prisma.adminLoginChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: now },
  })

  const rawToken = generateChallengeToken()
  await prisma.adminLoginChallenge.create({
    data: {
      email,
      tokenHash: hashChallengeToken(rawToken),
      expiresAt: new Date(Date.now() + ADMIN_CHALLENGE_TTL_MS),
    },
  })

  return NextResponse.json({ challengeToken: rawToken })
}