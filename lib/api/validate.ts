import { NextResponse } from 'next/server'
import { HTTP_STATUS_BAD_REQUEST } from '@/lib/constants'
import { z } from 'zod'
import type { ZodType } from 'zod'

export async function validateRequest<T>(
  req: Request,
  schema: ZodType<T>
): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse }
> {
  const body = await req.json().catch(() => null)

  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          issues: z.flattenError(parsed.error).fieldErrors,
        },
        { status: HTTP_STATUS_BAD_REQUEST }
      ),
    }
  }

  return {
    success: true,
    data: parsed.data,
  }
}