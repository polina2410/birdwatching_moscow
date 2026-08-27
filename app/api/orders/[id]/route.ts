import { NextResponse } from 'next/server'
import { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_NOT_FOUND } from '@/lib/constants'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS_UNAUTHORIZED })
  }

  const { id } = await Promise.resolve(context.params)
  const order = await prisma.order.findUnique({ where: { id } })

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: HTTP_STATUS_NOT_FOUND })
  }

  return NextResponse.json({ status: order.status })
}
