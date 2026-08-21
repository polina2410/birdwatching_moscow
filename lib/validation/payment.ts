import { z } from 'zod'

// Covers both `payment.*` and `refund.*` notifications — refund objects carry the
// same `id` / `status` / `amount` shape plus an extra `payment_id`, which Zod
// silently strips as an unrecognised key rather than rejecting the payload.
export const yookassaNotificationSchema = z.object({
  type: z.literal('notification'),
  event: z.string(),
  object: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.object({
      value: z.string(),
      currency: z.string(),
    }),
    metadata: z.record(z.string(), z.string()).optional(),
  }),
})