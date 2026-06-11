'use server'

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { generateSlug } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { createEventSchema, updateEventSchema, type CreateEventInput, type UpdateEventInput } from '@/lib/validation/admin'
import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'

async function ensureUniqueSlug(base: string): Promise<string> {
  const existing = await prisma.event.findFirst({ where: { slug: base } })
  if (!existing) return base
  for (let i = 0; i < 5; i++) {
    const candidate = `${base.slice(0, 191)}-${crypto.randomUUID().slice(0, 8)}`
    const conflict = await prisma.event.findFirst({ where: { slug: candidate } })
    if (!conflict) return candidate
  }
  throw new Error('Не удалось сгенерировать уникальный slug. Попробуйте изменить название события.')
}

export async function createEvent(
  input: CreateEventInput,
  publish = false,
): Promise<{ id: string; slug: string }> {
  const user = await requireAdmin()
  const parsed = createEventSchema.safeParse(input)
  if (!parsed.success) throw new Error('Validation failed')

  const data = parsed.data
  if (data.type === 'EXPEDITION' && data.spotsLeft > data.totalSpots) {
    throw new Error('Осталось мест не может превышать общее количество мест')
  }
  const baseSlug = data.slug || generateSlug(data.title)
  const slug = await ensureUniqueSlug(baseSlug)

  const now = new Date()
  const publishedFields = publish
    ? { status: 'ACTIVE' as const, publishedAt: now, publishedBy: user.id }
    : { status: 'DRAFT' as const }

  const event = await prisma.$transaction(async (tx) => {
    const ev = await tx.event.create({
      data: {
        type: data.type,
        slug,
        title: data.title,
        description: data.description,
        startsAt: new Date(data.startsAt),
        location: data.location,
        coverPhotoUrl: data.coverPhotoUrl,
        galleryUrls: data.galleryUrls,
        birdSpecies: data.birdSpecies,
        ...(data.type === 'WALK'
          ? { priceKopecks: data.priceKopecks, capacity: data.capacity }
          : { totalSpots: data.totalSpots, spotsLeft: data.spotsLeft }),
        ...publishedFields,
      },
    })

    if (data.type === 'EXPEDITION') {
      await tx.expeditionDay.createMany({
        data: data.days.map((d) => ({
          eventId: ev.id,
          dayNumber: d.dayNumber,
          title: d.title,
          description: d.description,
        })),
      })
      await tx.event.update({
        where: { id: ev.id },
        data: { guides: { connect: data.guideIds.map((id) => ({ id })) } },
      })
    }

    return ev
  })

  revalidatePath('/admin/events')
  return { id: event.id, slug: event.slug }
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<void> {
  await requireAdmin()
  const parsed = updateEventSchema.safeParse(input)
  if (!parsed.success) throw new Error('Validation failed')

  const data = parsed.data
  if (data.type === 'EXPEDITION' && data.spotsLeft > data.totalSpots) {
    throw new Error('Осталось мест не может превышать общее количество мест')
  }

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        startsAt: new Date(data.startsAt),
        location: data.location,
        coverPhotoUrl: data.coverPhotoUrl,
        galleryUrls: data.galleryUrls,
        birdSpecies: data.birdSpecies,
        ...(data.type === 'WALK'
          ? { priceKopecks: data.priceKopecks, capacity: data.capacity }
          : { totalSpots: data.totalSpots, spotsLeft: data.spotsLeft }),
      },
    })

    if (data.type === 'EXPEDITION') {
      await tx.expeditionDay.deleteMany({ where: { eventId: id } })
      await tx.expeditionDay.createMany({
        data: data.days.map((d) => ({
          eventId: id,
          dayNumber: d.dayNumber,
          title: d.title,
          description: d.description,
        })),
      })
      await tx.event.update({
        where: { id },
        data: {
          guides: {
            set: data.guideIds.map((gid) => ({ id: gid })),
          },
        },
      })
    }
  })

  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
}

export async function publishEvent(id: string): Promise<void> {
  const user = await requireAdmin()
  const event = await prisma.event.findUniqueOrThrow({ where: { id }, select: { status: true, publishedAt: true } })

  if (event.status !== 'DRAFT') throw new Error('Событие уже опубликовано')

  await prisma.event.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      ...(event.publishedAt == null
        ? { publishedAt: new Date(), publishedBy: user.id }
        : {}),
    },
  })

  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
}

export async function cancelEvent(id: string): Promise<void> {
  await requireAdmin()
  await prisma.event.update({ where: { id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
}

export async function restoreEvent(id: string, newStartsAt?: string): Promise<void> {
  await requireAdmin()
  const data: { status: 'DRAFT'; startsAt?: Date } = { status: 'DRAFT' }
  if (newStartsAt) data.startsAt = new Date(newStartsAt)
  await prisma.event.update({ where: { id, status: 'CANCELLED' }, data })
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
}

export async function deleteEvent(id: string): Promise<void> {
  await requireAdmin()

  const ticketCount = await prisma.ticket.count({ where: { eventId: id } })
  if (ticketCount > 0) throw new Error('Нельзя удалить событие с проданными билетами.')

  const now = new Date()
  const activeCart = await prisma.cartItem.findFirst({
    where: { eventId: id, reservedUntil: { gt: now } },
    orderBy: { reservedUntil: 'desc' },
    select: { reservedUntil: true },
  })
  if (activeCart) {
    const time = format(activeCart.reservedUntil, 'HH:mm')
    throw new Error(`Нельзя удалить событие: есть активные бронирования до ${time}. Попробуйте позже.`)
  }

  await prisma.event.update({ where: { id }, data: { status: 'DELETED' } })
  revalidatePath('/admin/events')
}
