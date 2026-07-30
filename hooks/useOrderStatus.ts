'use client';

import { useEffect, useState } from 'react';
import { ORDER_STATUS_POLL_INTERVAL_MS } from '@/lib/constants';

export type OrderStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED';

const TERMINAL_STATUSES: readonly OrderStatus[] = ['PAID', 'FAILED', 'EXPIRED'];

interface UseOrderStatusResult {
  status: OrderStatus | null;
  error: boolean;
}

// Polls GET /api/orders/[id] until the order reaches a terminal status.
// Never infers success from the ЮKassa redirect itself — only from this poll.
export function useOrderStatus(orderId: string | null): UseOrderStatusResult {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error('order status request failed');

        const data = (await res.json()) as { status: OrderStatus };
        if (cancelled) return;

        setStatus(data.status);
        setError(false);

        if (!TERMINAL_STATUSES.includes(data.status)) {
          timeoutId = setTimeout(poll, ORDER_STATUS_POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [orderId]);

  return { status, error };
}
