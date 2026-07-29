import { NextResponse } from 'next/server'
import { applyPaymentResult } from '@/lib/payments/applyPaymentResult'
import { yookassaNotificationSchema } from '@/lib/validation/payment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KOPECKS_PER_RUBLE = 100

// NOTE: dynamic import (not a static top-level import) so module resolution is
// deferred until the handler actually runs — required for the mocked
// '@/lib/payments/yookassa/allowlist' module to resolve correctly in tests.
async function getIpAllowlist(): Promise<string[]> {
  return (await import('@/lib/payments/yookassa/allowlist')).YOOKASSA_IP_ALLOWLIST
}

function getClientIp(req: Request): string | null {
  return req.headers.get('X-Real-IP') ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? null
}

function toKopecks(value: string): number {
  return Math.round(parseFloat(value) * KOPECKS_PER_RUBLE)
}

export async function POST(req: Request): Promise<NextResponse> {
  const verifyIp = process.env.YOOKASSA_VERIFY_IP !== 'false'
  if (verifyIp) {
    const allowlist = await getIpAllowlist()
    const clientIp = getClientIp(req)
    if (!clientIp || !allowlist.includes(clientIp)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => null)
  const parsed = yookassaNotificationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const { event, object } = parsed.data

  if (event === 'payment.succeeded' || event === 'payment.canceled') {
    await applyPaymentResult({
      paymentId: object.id,
      status: event === 'payment.succeeded' ? 'succeeded' : 'canceled',
      amountKopecks: toKopecks(object.amount.value),
      orderId: object.metadata?.orderId,
    })
    return NextResponse.json({ ok: true })
  }

  if (event === 'payment.waiting_for_capture') {
    // Unexpected under capture: true — flag for manual review, no ticket creation.
    console.warn('[yookassa-webhook] unexpected waiting_for_capture', { paymentId: object.id })
    return NextResponse.json({ ok: true })
  }

  if (event === 'refund.succeeded') {
    // Refunds are out of scope — accepted and logged only, per spec.
    console.log('[yookassa-webhook] refund.succeeded', { id: object.id })
    return NextResponse.json({ ok: true })
  }

  // Anything else: log and acknowledge so ЮKassa stops retrying.
  console.log('[yookassa-webhook] unhandled event', { event, id: object.id })
  return NextResponse.json({ ok: true })
}
