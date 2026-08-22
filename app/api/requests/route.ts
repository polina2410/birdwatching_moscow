import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateRequest } from '@/lib/api/validate'
import { requestBodySchema } from '@/lib/validation/requests'
import {
  HTTP_STATUS_CREATED,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from '@/lib/constants'

export async function POST(req: Request): Promise<NextResponse> {
  const validation = await validateRequest(req, requestBodySchema)
  if (!validation.success) return validation.response

  const data = validation.data

  try {
    if (data.type === 'EXPEDITION') {
      const expedition = await prisma.expedition.findUnique({
        where: { id: data.expeditionId },
        select: { id: true, status: true },
      })
      if (!expedition || expedition.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Expedition not found' }, { status: HTTP_STATUS_NOT_FOUND })
      }
    }

    const request = await prisma.request.create({
      data: {
        type: data.type,
        expeditionId: data.type === 'EXPEDITION' ? data.expeditionId : null,
        name: data.name,
        email: data.email,
        message: data.message ?? '',
        status: 'NEW',
      },
    })

    return NextResponse.json({ id: request.id }, { status: HTTP_STATUS_CREATED })
  } catch (err) {
    console.error('POST /api/requests failed', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
    )
  }
}
