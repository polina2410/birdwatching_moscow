import { z } from 'zod'
import { MAX_EMAIL } from '@/lib/constants'

const MAX_REQUEST_NAME = 100
const MAX_REQUEST_MESSAGE = 2000

const expeditionRequestSchema = z
  .object({
    type: z.literal('EXPEDITION'),
    expeditionId: z.string().uuid(),
    name: z.string().min(1).max(MAX_REQUEST_NAME),
    email: z.string().email().max(MAX_EMAIL),
    message: z.string().max(MAX_REQUEST_MESSAGE).optional(),
  })
  .strict()

const privateWalkRequestSchema = z
  .object({
    type: z.literal('PRIVATE_WALK'),
    name: z.string().min(1).max(MAX_REQUEST_NAME),
    email: z.string().email().max(MAX_EMAIL),
    message: z.string().min(1).max(MAX_REQUEST_MESSAGE),
  })
  .strict()

export const requestBodySchema = z.discriminatedUnion('type', [
  expeditionRequestSchema,
  privateWalkRequestSchema,
])
