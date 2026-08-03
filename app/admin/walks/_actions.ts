'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth/permissions'
import { ensureUniqueSlug } from '@/lib/admin/slug'

async function requireAdmin() {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) throw new Error('Недостаточно прав')
  return session
}

type WalkInput = {
  type: 'WALK'
  title: string
  description: string
  startsAt: string
  location: string
  coverPhotoUrl: string
  galleryUrl?: string
  priceKopecks: number
  capacity: number
  guideId: number
  slug?: string
  duration?: string
}

export async function createWalk(input: WalkInput): Promise<string> {
  await requireAdmin()
  const slug = input.slug ?? await ensureUniqueSlug(input.title, async (s) => {
    const existing = await prisma.walk.findFirst({ where: { slug: s } })
    return existing != null
  })
  const walk = await prisma.walk.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      startsAt: new Date(input.startsAt),
      duration: input.duration ?? null,
      location: input.location,
      coverPhotoUrl: input.coverPhotoUrl,
      galleryUrl: input.galleryUrl ?? null,
      priceKopecks: input.priceKopecks,
      capacity: input.capacity,
      guideId: input.guideId,
    },
  })
  return walk.id
}

export async function updateWalk(id: string, input: WalkInput): Promise<void> {
  await requireAdmin()
  await prisma.walk.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      startsAt: new Date(input.startsAt),
      duration: input.duration ?? null,
      location: input.location,
      coverPhotoUrl: input.coverPhotoUrl,
      galleryUrl: input.galleryUrl ?? null,
      priceKopecks: input.priceKopecks,
      capacity: input.capacity,
      guideId: input.guideId,
    },
  })
}

export async function publishWalk(id: string): Promise<void> {
  const session = await requireAdmin()
  const walk = await prisma.walk.findFirst({ where: { id } })
  if (!walk) throw new Error('Прогулка не найдена')
  if (walk.status === 'ACTIVE') throw new Error('Прогулка уже опубликована')
  await prisma.walk.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      publishedAt: walk.publishedAt ?? new Date(),
      publishedBy: walk.publishedBy ?? session.user.id,
    },
  })
}

export async function cancelWalk(id: string): Promise<void> {
  await requireAdmin()
  const walk = await prisma.walk.findFirst({ where: { id } })
  if (!walk) throw new Error('Прогулка не найдена')
  if (walk.status !== 'ACTIVE') throw new Error('Нельзя отменить: прогулка не активна')
  await prisma.walk.update({ where: { id }, data: { status: 'CANCELLED' } })
}

export async function restoreWalk(id: string, newStartsAt?: string): Promise<void> {
  await requireAdmin()
  const walk = await prisma.walk.findFirst({ where: { id } })
  if (!walk) throw new Error('Прогулка не найдена')
  const startsAt = new Date(walk.startsAt)
  if (startsAt < new Date() && !newStartsAt) {
    throw new Error('Укажите новую дату: дата прогулки в прошлом')
  }
  const resolvedStartsAt = newStartsAt ? new Date(newStartsAt) : startsAt
  if (newStartsAt && resolvedStartsAt < new Date()) {
    throw new Error('Новая дата должна быть в будущем')
  }
  await prisma.walk.update({
    where: { id },
    data: { status: 'DRAFT', startsAt: resolvedStartsAt },
  })
}

export async function deleteWalk(id: string): Promise<void> {
  await requireAdmin()
  const walk = await prisma.walk.findFirst({ where: { id } })
  if (!walk) throw new Error('Прогулка не найдена')

  const ticketCount = await prisma.ticket.count({ where: { walkId: id } })
  if (ticketCount > 0) {
    throw new Error('Нельзя удалить прогулку с проданными билетами.')
  }

  const cartResult = await prisma.cartItem.aggregate({
    where: { walkId: id, reservedUntil: { gt: new Date() } },
    _count: { id: true },
    _max: { reservedUntil: true },
  })
  if (cartResult._count.id > 0) {
    const until = cartResult._max.reservedUntil
    const time = until ? until.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '?'
    throw new Error(`Нельзя удалить прогулку: есть активные бронирования до ${time}. Попробуйте позже.`)
  }

  await prisma.walk.update({ where: { id }, data: { status: 'DELETED' } })
}
