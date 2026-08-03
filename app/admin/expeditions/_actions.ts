'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth/permissions'
import { ensureUniqueSlug } from '@/lib/admin/slug'

const MAX_EXPEDITION_GALLERY = 5

async function requireAdmin() {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) throw new Error('Недостаточно прав')
  return session
}

type DayInput = { clientId: string; dayNumber: number; title: string; description: string }

type ExpeditionInput = {
  type: 'EXPEDITION'
  title: string
  description: string
  startsAt: string
  endsAt?: string
  location: string
  coverPhotoUrl: string
  galleryUrls: string[]
  totalSpots: number
  spotsLeft: number
  guideIds: string[]
  days: DayInput[]
  slug?: string
}

function validateGallery(galleryUrls: string[]) {
  if (galleryUrls.length > MAX_EXPEDITION_GALLERY) {
    throw new Error(`Галерея: не более 5 изображений.`)
  }
}

export async function createExpedition(input: ExpeditionInput): Promise<string> {
  await requireAdmin()
  validateGallery(input.galleryUrls)

  const slug = input.slug ?? await ensureUniqueSlug(input.title, async (s) => {
    const existing = await prisma.expedition.findFirst({ where: { slug: s } })
    return existing != null
  })

  const expedition = await prisma.expedition.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      location: input.location,
      coverPhotoUrl: input.coverPhotoUrl,
      galleryUrls: input.galleryUrls,
      totalSpots: input.totalSpots,
      spotsLeft: input.totalSpots,
      guides: { connect: input.guideIds.map((id) => ({ id: parseInt(id, 10) })) },
      days: {
        create: input.days.map((d) => ({
          dayNumber: d.dayNumber,
          title: d.title,
          description: d.description,
        })),
      },
    },
  })
  return expedition.id
}

export async function updateExpedition(id: string, input: ExpeditionInput): Promise<void> {
  await requireAdmin()
  validateGallery(input.galleryUrls)

  await prisma.expeditionDay.deleteMany({ where: { expeditionId: id } })
  await prisma.expedition.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      location: input.location,
      coverPhotoUrl: input.coverPhotoUrl,
      galleryUrls: input.galleryUrls,
      totalSpots: input.totalSpots,
      spotsLeft: input.spotsLeft,
      guides: { set: input.guideIds.map((gid) => ({ id: parseInt(gid, 10) })) },
      days: {
        create: input.days.map((d) => ({
          dayNumber: d.dayNumber,
          title: d.title,
          description: d.description,
        })),
      },
    },
  })
}

export async function publishExpedition(id: string): Promise<void> {
  const session = await requireAdmin()
  const expedition = await prisma.expedition.findFirst({ where: { id } })
  if (!expedition) throw new Error('Экспедиция не найдена')
  if (expedition.status === 'ACTIVE') throw new Error('Экспедиция уже опубликована')
  await prisma.expedition.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      publishedAt: expedition.publishedAt ?? new Date(),
      publishedBy: expedition.publishedBy ?? session.user.id,
    },
  })
}

export async function cancelExpedition(id: string): Promise<void> {
  await requireAdmin()
  const expedition = await prisma.expedition.findFirst({ where: { id } })
  if (!expedition) throw new Error('Экспедиция не найдена')
  if (expedition.status !== 'ACTIVE') throw new Error('Нельзя отменить: экспедиция не активна')
  await prisma.expedition.update({ where: { id }, data: { status: 'CANCELLED' } })
}

export async function restoreExpedition(id: string, newStartsAt?: string): Promise<void> {
  await requireAdmin()
  const expedition = await prisma.expedition.findFirst({ where: { id } })
  if (!expedition) throw new Error('Экспедиция не найдена')
  const startsAt = new Date(expedition.startsAt)
  if (startsAt < new Date() && !newStartsAt) {
    throw new Error('Укажите новую дату: дата экспедиции в прошлом')
  }
  const resolvedStartsAt = newStartsAt ? new Date(newStartsAt) : startsAt
  if (newStartsAt && resolvedStartsAt < new Date()) {
    throw new Error('Новая дата должна быть в будущем')
  }
  await prisma.expedition.update({
    where: { id },
    data: { status: 'DRAFT', startsAt: resolvedStartsAt },
  })
}

export async function deleteExpedition(id: string): Promise<void> {
  await requireAdmin()
  const requestCount = await prisma.request.count({ where: { expeditionId: id } })
  if (requestCount > 0) throw new Error('Нельзя удалить экспедицию с заявками.')
  await prisma.expedition.update({ where: { id }, data: { status: 'DELETED' } })
}
