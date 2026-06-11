import { z } from 'zod'
import {
  MAX_EVENT_TITLE,
  MAX_EVENT_LOCATION,
  MAX_DESCRIPTION,
  MAX_URL,
  MAX_GALLERY_IMAGES,
  MAX_EXPEDITION_DAY_TITLE,
  MAX_EXPEDITION_DAYS,
  MAX_GUIDES_PER_EVENT,
  MAX_EVENT_SLUG,
  MAX_NAME,
  MAX_PROFILE_LINKS,
} from '@/lib/constants'
import { RequestStatus, Role } from '@/generated/prisma/client'

// ─── Expedition Day ───────────────────────────────────────────────────────────

export const expeditionDaySchema = z.object({
  clientId: z.string().min(1),
  dayNumber: z.number().int().min(1),
  title: z.string().min(1).max(MAX_EXPEDITION_DAY_TITLE),
  description: z.string().max(MAX_DESCRIPTION),
})

export type ExpeditionDayInput = z.infer<typeof expeditionDaySchema>

// ─── Events ───────────────────────────────────────────────────────────────────

const galleryUrlItem = z.string().url().max(MAX_URL)
const coverPhotoUrl = z.string().url().max(MAX_URL)
const slugSchema = z.string().min(1).max(MAX_EVENT_SLUG).regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')

const eventBaseSchema = z.object({
  title: z.string().min(1).max(MAX_EVENT_TITLE),
  description: z.string().max(MAX_DESCRIPTION),
  startsAt: z.string().datetime({ offset: true }),
  location: z.string().min(1).max(MAX_EVENT_LOCATION),
  coverPhotoUrl,
  galleryUrls: z.array(galleryUrlItem).max(MAX_GALLERY_IMAGES),
  birdSpecies: z.array(z.string()),
  slug: slugSchema,
})

const walkFields = z.object({
  priceKopecks: z.number().int().min(0),
  capacity: z.number().int().min(1),
})

const expeditionFields = z.object({
  totalSpots: z.number().int().min(1),
  spotsLeft: z.number().int().min(0),
  days: z.array(expeditionDaySchema).min(1).max(MAX_EXPEDITION_DAYS),
  guideIds: z.array(z.string()).min(1).max(MAX_GUIDES_PER_EVENT),
})

export const createWalkSchema = eventBaseSchema.merge(walkFields).extend({
  type: z.literal('WALK'),
})

export const createExpeditionSchema = eventBaseSchema.merge(expeditionFields).extend({
  type: z.literal('EXPEDITION'),
})

export const createEventSchema = z.discriminatedUnion('type', [
  createWalkSchema,
  createExpeditionSchema,
])

export type CreateEventInput = z.infer<typeof createEventSchema>

// Edit: slug is not editable (read-only), type is fixed
const editEventBaseSchema = eventBaseSchema.omit({ slug: true })

export const updateWalkSchema = editEventBaseSchema.merge(walkFields).extend({
  type: z.literal('WALK'),
})

export const updateExpeditionSchema = editEventBaseSchema.merge(expeditionFields).extend({
  type: z.literal('EXPEDITION'),
})

export const updateEventSchema = z.discriminatedUnion('type', [
  updateWalkSchema,
  updateExpeditionSchema,
])

export type UpdateEventInput = z.infer<typeof updateEventSchema>

// ─── Team ─────────────────────────────────────────────────────────────────────

export const teamMemberSchema = z.object({
  name: z.string().min(1).max(MAX_NAME),
  photoUrl: z.string().url().max(MAX_URL),
  education: z.string().max(MAX_DESCRIPTION).optional(),
  achievements: z.string().max(MAX_DESCRIPTION).optional(),
  profileLinks: z.array(z.string().url().max(MAX_URL)).max(MAX_PROFILE_LINKS),
  sortOrder: z.number().int().min(0),
})

export type TeamMemberInput = z.infer<typeof teamMemberSchema>

// ─── Requests ────────────────────────────────────────────────────────────────

export const updateRequestStatusSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(RequestStatus),
})

export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>

// ─── Users ───────────────────────────────────────────────────────────────────

export const changeUserRoleSchema = z.object({
  targetUserId: z.string().min(1),
  newRole: z.nativeEnum(Role),
})

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>
