import { z } from 'zod'

const YOOKASSA_DEFAULT_API_URL = 'https://api.yookassa.ru/v3'
const DEFAULT_APP_URL = 'http://localhost:3000'

const booleanFlag = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true'))

const envSchema = z
  .object({
    YOOKASSA_MODE: z.enum(['stub', 'live']).default('stub'),
    YOOKASSA_SHOP_ID: z.string().optional(),
    YOOKASSA_SECRET_KEY: z.string().optional(),
    YOOKASSA_API_URL: z.string().default(YOOKASSA_DEFAULT_API_URL),
    YOOKASSA_VERIFY_IP: booleanFlag(true),
    YOOKASSA_RECEIPT_ENABLED: booleanFlag(true),
    YOOKASSA_VAT_CODE: z.string().optional(),
    APP_URL: z.string().default(DEFAULT_APP_URL),
  })
  .superRefine((value, ctx) => {
    if (value.YOOKASSA_MODE !== 'live') return

    if (!value.YOOKASSA_SHOP_ID) {
      ctx.addIssue({
        code: 'custom',
        message: 'YOOKASSA_SHOP_ID is required when YOOKASSA_MODE=live',
        path: ['YOOKASSA_SHOP_ID'],
      })
    }
    if (!value.YOOKASSA_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'YOOKASSA_SECRET_KEY is required when YOOKASSA_MODE=live',
        path: ['YOOKASSA_SECRET_KEY'],
      })
    }
    if (value.YOOKASSA_RECEIPT_ENABLED && !value.YOOKASSA_VAT_CODE) {
      ctx.addIssue({
        code: 'custom',
        message: 'YOOKASSA_VAT_CODE is required when YOOKASSA_MODE=live and receipts are enabled',
        path: ['YOOKASSA_VAT_CODE'],
      })
    }
  })

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`)
  }
  return parsed.data
}

// NOTE: validated once at module load — mirrors the "no code changes to go live" requirement:
// switching YOOKASSA_MODE to 'live' without shop id / secret / VAT code throws at startup,
// not on the first payment attempt.
export const env = loadEnv()
